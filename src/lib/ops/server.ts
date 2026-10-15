import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  addDays,
  lastMonths,
  monthBounds,
  monthLabel,
  saoPauloToday,
} from "@/lib/ops/format";
import type {
  Activity,
  Appointment,
  AssistantMessage,
  Client,
  ClientStatus,
  Contract,
  ContractStatus,
  Directory,
  Finance,
  FinanceKind,
  FinanceStatus,
  MonthPoint,
  Priority,
  Project,
  ProjectStatus,
  ProjectUpdate,
  SearchHit,
  Task,
  TaskScope,
  UpdateStatus,
} from "@/lib/ops/types";

type Row = Record<string, unknown>;

const TABLES = new Set([
  "clients",
  "projects",
  "updates",
  "contracts",
  "finances",
  "tasks",
  "appointments",
  "activities",
  "assistant_messages",
]);
const COL = /^[a-z_]+$/;

const clientStatus = z.enum(["ativo", "negociacao", "inativo"]);
const projectStatus = z.enum(["planejamento", "andamento", "entregue", "manutencao", "pausado"]);
const updateStatus = z.enum(["planejada", "andamento", "entregue"]);
const contractStatus = z.enum(["rascunho", "aguardando", "assinado", "encerrado"]);
const financeKind = z.enum(["entrada", "saida"]);
const financeStatus = z.enum(["pendente", "pago", "cancelado"]);
const taskScope = z.enum(["empresa", "pessoal"]);
const priority = z.enum(["alta", "normal", "baixa"]);
const appointmentStatus = z.enum(["agendado", "concluido", "cancelado"]);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");

function read<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}

function nid(): string {
  return crypto.randomUUID();
}

function num(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function dateOf(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return value == null ? "" : String(value);
}

function flag(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

function like(value: string): string {
  return `%${value.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

function opt(value: string | null | undefined): string | null {
  const next = value?.trim() ?? "";
  return next ? next : null;
}

async function db(): Promise<Sql> {
  return getSql();
}

async function insert(sql: Sql, table: string, cols: Record<string, unknown>) {
  if (!TABLES.has(table)) throw new Error("Tabela inválida.");
  const keys = Object.keys(cols);
  if (!keys.length || keys.some((key) => !COL.test(key))) throw new Error("Coluna inválida.");
  const params = keys.map((key) => cols[key]);
  await sql.query(
    `insert into ${table} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
    params,
  );
}

async function updateRow(sql: Sql, table: string, id: string, userId: string, cols: Record<string, unknown>) {
  if (!TABLES.has(table)) throw new Error("Tabela inválida.");
  const keys = Object.keys(cols);
  if (!keys.length || keys.some((key) => !COL.test(key))) throw new Error("Coluna inválida.");
  const params: unknown[] = [];
  const sets = keys.map((key) => {
    params.push(cols[key]);
    return `${key} = $${params.length}`;
  });
  params.push(id, userId);
  const rows = await sql.query<{ id: string }>(
    `update ${table} set ${sets.join(", ")}, updated_at = now() where id = $${params.length - 1} and user_id = $${params.length} returning id`,
    params,
  );
  if (!rows.length) throw new Error("Registro não encontrado.");
}

async function activity(
  sql: Sql,
  userId: string,
  summary: string,
  extra?: { clientId?: string | null; projectId?: string | null; kind?: string },
) {
  await insert(sql, "activities", {
    id: nid(),
    user_id: userId,
    client_id: extra?.clientId ?? null,
    project_id: extra?.projectId ?? null,
    kind: extra?.kind ?? "nota",
    summary,
  });
}

async function assertClient(sql: Sql, userId: string, clientId: string | null | undefined) {
  if (!clientId) return;
  const rows = await sql.query("select id from clients where id = $1 and user_id = $2", [clientId, userId]);
  if (!rows.length) throw new Error("Cliente não encontrado.");
}

async function assertProject(sql: Sql, userId: string, projectId: string | null | undefined) {
  if (!projectId) return;
  const rows = await sql.query("select id from projects where id = $1 and user_id = $2", [projectId, userId]);
  if (!rows.length) throw new Error("Projeto não encontrado.");
}

function mapClient(row: Row): Client {
  return {
    id: str(row.id),
    name: str(row.name),
    company: str(row.company),
    phone: str(row.phone),
    whatsapp: str(row.whatsapp),
    email: str(row.email),
    segment: str(row.segment),
    document: str(row.document),
    address: str(row.address),
    status: str(row.status) as ClientStatus,
    notes: str(row.notes),
    extra: str(row.extra),
    archivedAt: row.archived_at ? iso(row.archived_at) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapProject(row: Row): Project {
  return {
    id: str(row.id),
    clientId: row.client_id ? str(row.client_id) : null,
    clientName: str(row.client_name),
    name: str(row.name),
    description: str(row.description),
    startDate: dateOf(row.start_date),
    dueDate: dateOf(row.due_date),
    status: str(row.status) as ProjectStatus,
    url: str(row.url),
    repo: str(row.repo),
    databaseUsed: str(row.database_used),
    databaseName: str(row.database_name),
    server: str(row.server),
    techConfig: str(row.tech_config),
    notes: str(row.notes),
    valueCents: num(row.value_cents),
    monthlyCents: num(row.monthly_cents),
    archivedAt: row.archived_at ? iso(row.archived_at) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapUpdate(row: Row): ProjectUpdate {
  return {
    id: str(row.id),
    projectId: str(row.project_id),
    projectName: str(row.project_name),
    version: str(row.version),
    happenedOn: dateOf(row.happened_on) ?? "",
    description: str(row.description),
    bugfix: str(row.bugfix),
    feature: str(row.feature),
    status: str(row.status) as UpdateStatus,
    notes: str(row.notes),
    createdAt: iso(row.created_at),
  };
}

function mapContract(row: Row, withDoc = false): Contract {
  return {
    id: str(row.id),
    clientId: row.client_id ? str(row.client_id) : null,
    clientName: str(row.client_name),
    projectId: row.project_id ? str(row.project_id) : null,
    projectName: str(row.project_name),
    type: str(row.type),
    startDate: dateOf(row.start_date),
    endDate: dateOf(row.end_date),
    valueCents: num(row.value_cents),
    monthlyCents: num(row.monthly_cents),
    conditions: str(row.conditions),
    notes: str(row.notes),
    status: str(row.status) as ContractStatus,
    documentName: str(row.document_name),
    hasDocument: flag(row.has_document) || str(row.document_data).length > 0,
    documentData: withDoc ? str(row.document_data) : undefined,
    archivedAt: row.archived_at ? iso(row.archived_at) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapFinance(row: Row): Finance {
  return {
    id: str(row.id),
    kind: str(row.kind) as FinanceKind,
    clientId: row.client_id ? str(row.client_id) : null,
    clientName: str(row.client_name),
    projectId: row.project_id ? str(row.project_id) : null,
    projectName: str(row.project_name),
    category: str(row.category),
    description: str(row.description),
    amountCents: num(row.amount_cents),
    happenedOn: dateOf(row.happened_on) ?? "",
    dueOn: dateOf(row.due_on),
    paidOn: dateOf(row.paid_on),
    paymentMethod: str(row.payment_method),
    status: str(row.status) as FinanceStatus,
    notes: str(row.notes),
    createdAt: iso(row.created_at),
  };
}

function mapTask(row: Row): Task {
  return {
    id: str(row.id),
    scope: str(row.scope) as TaskScope,
    title: str(row.title),
    description: str(row.description),
    dueOn: dateOf(row.due_on),
    dueTime: str(row.due_time),
    priority: str(row.priority) as Priority,
    category: str(row.category),
    clientId: row.client_id ? str(row.client_id) : null,
    clientName: str(row.client_name),
    projectId: row.project_id ? str(row.project_id) : null,
    projectName: str(row.project_name),
    done: flag(row.done),
    createdAt: iso(row.created_at),
  };
}

function mapAppointment(row: Row): Appointment {
  return {
    id: str(row.id),
    title: str(row.title),
    happensOn: dateOf(row.happens_on) ?? "",
    startsAt: str(row.starts_at),
    durationMin: num(row.duration_min) || 60,
    clientId: row.client_id ? str(row.client_id) : null,
    clientName: str(row.client_name),
    location: str(row.location),
    notes: str(row.notes),
    status: str(row.status) as "agendado" | "concluido" | "cancelado",
    createdAt: iso(row.created_at),
  };
}

function mapActivity(row: Row): Activity {
  return {
    id: str(row.id),
    clientId: row.client_id ? str(row.client_id) : null,
    projectId: row.project_id ? str(row.project_id) : null,
    kind: str(row.kind),
    summary: str(row.summary),
    createdAt: iso(row.created_at),
  };
}

const PROJECT_SELECT = `
  select p.*, c.name as client_name
  from projects p
  left join clients c on c.id = p.client_id and c.user_id = p.user_id
`;

const CONTRACT_SELECT = `
  select ct.id, ct.user_id, ct.client_id, ct.project_id, ct.type, ct.start_date, ct.end_date,
         ct.value_cents, ct.monthly_cents, ct.conditions, ct.notes, ct.status, ct.document_name,
         ct.archived_at, ct.created_at, ct.updated_at,
         (ct.document_data <> '') as has_document,
         c.name as client_name, p.name as project_name
  from contracts ct
  left join clients c on c.id = ct.client_id and c.user_id = ct.user_id
  left join projects p on p.id = ct.project_id and p.user_id = ct.user_id
`;

const FINANCE_SELECT = `
  select f.*, c.name as client_name, p.name as project_name
  from finances f
  left join clients c on c.id = f.client_id and c.user_id = f.user_id
  left join projects p on p.id = f.project_id and p.user_id = f.user_id
`;

const TASK_SELECT = `
  select t.*, c.name as client_name, p.name as project_name
  from tasks t
  left join clients c on c.id = t.client_id and c.user_id = t.user_id
  left join projects p on p.id = t.project_id and p.user_id = t.user_id
`;

const APPT_SELECT = `
  select a.*, c.name as client_name
  from appointments a
  left join clients c on c.id = a.client_id and c.user_id = a.user_id
`;

async function monthSeries(sql: Sql, userId: string, today: string): Promise<MonthPoint[]> {
  const keys = lastMonths(today, 6);
  const rows = await sql.query<Row>(
    `select to_char(date_trunc('month', coalesce(paid_on, happened_on)), 'YYYY-MM') as month,
            kind, sum(amount_cents) as total
     from finances
     where user_id = $1 and status = 'pago'
       and coalesce(paid_on, happened_on) >= $2::date
     group by 1, 2`,
    [userId, `${keys[0]}-01`],
  );
  return keys.map((month) => ({
    month,
    label: monthLabel(month),
    entrada: num(rows.find((row) => str(row.month) === month && row.kind === "entrada")?.total),
    saida: num(rows.find((row) => str(row.month) === month && row.kind === "saida")?.total),
  }));
}

export const getDirectory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Directory> => {
    const sql = await db();
    const [clients, projects] = await Promise.all([
      sql.query<Row>(
        "select id, name, company, status from clients where user_id = $1 and archived_at is null order by name asc limit 400",
        [context.userId],
      ),
      sql.query<Row>(
        "select id, name, client_id, status from projects where user_id = $1 and archived_at is null order by name asc limit 400",
        [context.userId],
      ),
    ]);
    return {
      today: saoPauloToday(),
      clients: clients.map((row) => ({
        id: str(row.id),
        name: str(row.name),
        company: str(row.company),
        status: str(row.status) as ClientStatus,
      })),
      projects: projects.map((row) => ({
        id: str(row.id),
        name: str(row.name),
        clientId: row.client_id ? str(row.client_id) : null,
        status: str(row.status) as ProjectStatus,
      })),
    };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const userId = context.userId;
    const today = saoPauloToday();
    const bounds = monthBounds(today);
    const soon = addDays(today, 30);
    const [clients, projects, tasksOpen, contracts, money, urgent, upcoming, attention, stale, recent, expiring, series, totalClients] =
      await Promise.all([
        sql.query<Row>(
          `select
             count(*) filter (where archived_at is null and status = 'ativo') as active,
             count(*) filter (where archived_at is null and status = 'negociacao') as negotiation
           from clients where user_id = $1`,
          [userId],
        ),
        sql.query<Row>(
          `select
             count(*) filter (where archived_at is null and status in ('planejamento','andamento','manutencao')) as active,
             count(*) filter (where archived_at is null and status = 'manutencao') as maintenance
           from projects where user_id = $1`,
          [userId],
        ),
        sql.query<Row>("select count(*) as n from tasks where user_id = $1 and done = false", [userId]),
        sql.query<Row>(
          "select count(*) as n from contracts where user_id = $1 and archived_at is null and status = 'assinado'",
          [userId],
        ),
        sql.query<Row>(
          `select
             coalesce(sum(case when kind = 'entrada' and status = 'pendente' then amount_cents else 0 end), 0) as receivable,
             coalesce(sum(case when kind = 'entrada' and status = 'pago' and coalesce(paid_on, happened_on) >= $2::date and coalesce(paid_on, happened_on) < $3::date then amount_cents else 0 end), 0) as received,
             coalesce(sum(case when kind = 'saida' and status = 'pago' and coalesce(paid_on, happened_on) >= $2::date and coalesce(paid_on, happened_on) < $3::date then amount_cents else 0 end), 0) as expenses
           from finances where user_id = $1`,
          [userId, bounds.start, bounds.end],
        ),
        sql.query<Row>(
          `${TASK_SELECT} where t.user_id = $1 and t.done = false
           order by case t.priority when 'alta' then 0 when 'normal' then 1 else 2 end, t.due_on asc nulls last
           limit 6`,
          [userId],
        ),
        sql.query<Row>(
          `${APPT_SELECT} where a.user_id = $1 and a.status = 'agendado' and a.happens_on >= $2::date
           order by a.happens_on asc, a.starts_at asc limit 6`,
          [userId, today],
        ),
        sql.query<Row>(
          "select id, name, company, status from clients where user_id = $1 and archived_at is null and status = 'negociacao' order by updated_at desc limit 5",
          [userId],
        ),
        sql.query<Row>(
          `select p.id, p.name, p.status, c.name as client_name
           from projects p
           left join clients c on c.id = p.client_id and c.user_id = p.user_id
           where p.user_id = $1 and p.archived_at is null and p.status in ('andamento','manutencao')
             and not exists (
               select 1 from updates u
               where u.project_id = p.id and u.user_id = p.user_id and u.created_at > now() - interval '21 days'
             )
           order by p.updated_at asc limit 5`,
          [userId],
        ),
        sql.query<Row>(
          "select * from activities where user_id = $1 order by created_at desc limit 8",
          [userId],
        ),
        sql.query<Row>(
          `${CONTRACT_SELECT}
           where ct.user_id = $1 and ct.archived_at is null and ct.status = 'assinado'
             and ct.end_date is not null and ct.end_date >= $2::date and ct.end_date <= $3::date
           order by ct.end_date asc limit 5`,
          [userId, today, soon],
        ),
        monthSeries(sql, userId, today),
        sql.query<Row>("select count(*) as n from clients where user_id = $1", [userId]),
      ]);
    const received = num(money[0]?.received);
    const expenses = num(money[0]?.expenses);
    return {
      today,
      empty: num(totalClients[0]?.n) === 0,
      counts: {
        clientsActive: num(clients[0]?.active),
        clientsNegotiation: num(clients[0]?.negotiation),
        projectsActive: num(projects[0]?.active),
        projectsMaintenance: num(projects[0]?.maintenance),
        tasksPending: num(tasksOpen[0]?.n),
        contractsActive: num(contracts[0]?.n),
        receivableCents: num(money[0]?.receivable),
        receivedMonthCents: received,
        expensesMonthCents: expenses,
        profitMonthCents: received - expenses,
      },
      urgentTasks: urgent.map(mapTask),
      upcoming: upcoming.map(mapAppointment),
      attention: attention.map((row) => ({
        id: str(row.id),
        name: str(row.name),
        company: str(row.company),
        status: str(row.status),
      })),
      staleProjects: stale.map((row) => ({
        id: str(row.id),
        name: str(row.name),
        clientName: str(row.client_name),
        status: str(row.status),
      })),
      expiring: expiring.map((row) => mapContract(row)),
      recent: recent.map(mapActivity),
      series,
    };
  });

const clientInput = z.object({
  id: z.string().min(8).max(80).optional(),
  name: z.string().trim().min(1, "Informe o nome.").max(160),
  company: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  whatsapp: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  segment: z.string().trim().max(80).optional(),
  document: z.string().trim().max(32).optional(),
  address: z.string().trim().max(300).optional(),
  status: clientStatus.optional(),
  notes: z.string().trim().max(4000).optional(),
  extra: z.string().trim().max(4000).optional(),
});

export const listClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input ?? {})
  .handler(async ({ context, data }) => {
    const filter = read(
      z.object({
        q: z.string().max(80).optional(),
        status: clientStatus.optional(),
        archived: z.boolean().optional(),
      }),
      data,
    );
    const sql = await db();
    const params: unknown[] = [context.userId];
    const where = ["user_id = $1", filter.archived ? "archived_at is not null" : "archived_at is null"];
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter.q?.trim()) {
      params.push(like(filter.q.trim()));
      const i = params.length;
      where.push(
        `(name ilike $${i} escape '\\' or company ilike $${i} escape '\\' or email ilike $${i} escape '\\' or phone ilike $${i} escape '\\')`,
      );
    }
    const rows = await sql.query<Row>(
      `select * from clients where ${where.join(" and ")} order by name asc limit 400`,
      params,
    );
    return rows.map(mapClient);
  });

export const getClient = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { id } = read(z.object({ id: z.string().min(8) }), data);
    const sql = await db();
    const userId = context.userId;
    const rows = await sql.query<Row>("select * from clients where id = $1 and user_id = $2", [id, userId]);
    if (!rows[0]) return null;
    const [projects, contracts, finances, tasks, appointments, activities] = await Promise.all([
      sql.query<Row>(`${PROJECT_SELECT} where p.user_id = $1 and p.client_id = $2 order by p.updated_at desc`, [userId, id]),
      sql.query<Row>(`${CONTRACT_SELECT} where ct.user_id = $1 and ct.client_id = $2 order by ct.updated_at desc`, [userId, id]),
      sql.query<Row>(`${FINANCE_SELECT} where f.user_id = $1 and f.client_id = $2 order by f.happened_on desc`, [userId, id]),
      sql.query<Row>(`${TASK_SELECT} where t.user_id = $1 and t.client_id = $2 order by t.done asc, t.due_on asc nulls last`, [userId, id]),
      sql.query<Row>(`${APPT_SELECT} where a.user_id = $1 and a.client_id = $2 order by a.happens_on desc`, [userId, id]),
      sql.query<Row>("select * from activities where user_id = $1 and client_id = $2 order by created_at desc limit 30", [userId, id]),
    ]);
    return {
      client: mapClient(rows[0]),
      projects: projects.map(mapProject),
      contracts: contracts.map((row) => mapContract(row)),
      finances: finances.map(mapFinance),
      tasks: tasks.map(mapTask),
      appointments: appointments.map(mapAppointment),
      activities: activities.map(mapActivity),
    };
  });

export const saveClient = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const input = read(clientInput, data);
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("E-mail inválido.");
    const sql = await db();
    const cols = {
      name: input.name,
      company: input.company ?? "",
      phone: input.phone ?? "",
      whatsapp: input.whatsapp ?? "",
      email: input.email ?? "",
      segment: input.segment ?? "",
      document: input.document ?? "",
      address: input.address ?? "",
      status: input.status ?? "ativo",
      notes: input.notes ?? "",
      extra: input.extra ?? "",
    };
    if (input.id) {
      await updateRow(sql, "clients", input.id, context.userId, cols);
      await activity(sql, context.userId, `Cliente atualizado: ${input.name}.`, { clientId: input.id, kind: "cliente" });
      return { id: input.id, created: false };
    }
    const id = nid();
    await insert(sql, "clients", { id, user_id: context.userId, ...cols });
    await activity(sql, context.userId, `Cliente cadastrado: ${input.name}.`, { clientId: id, kind: "cliente" });
    return { id, created: true };
  });

export const setClientArchived = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const input = read(z.object({ id: z.string().min(8), archived: z.boolean() }), data);
    const sql = await db();
    await updateRow(sql, "clients", input.id, context.userId, {
      archived_at: input.archived ? new Date().toISOString() : null,
    });
    await activity(sql, context.userId, input.archived ? "Cliente arquivado." : "Cliente restaurado.", {
      clientId: input.id,
      kind: "cliente",
    });
    return { ok: true as const };
  });

const projectInput = z.object({
  id: z.string().min(8).optional(),
  clientId: z.string().min(8).nullable().optional(),
  name: z.string().trim().min(1, "Informe o nome do projeto.").max(160),
  description: z.string().trim().max(4000).optional(),
  startDate: day.nullable().optional(),
  dueDate: day.nullable().optional(),
  status: projectStatus.optional(),
  url: z.string().trim().max(300).optional(),
  repo: z.string().trim().max(300).optional(),
  databaseUsed: z.string().trim().max(80).optional(),
  databaseName: z.string().trim().max(120).optional(),
  server: z.string().trim().max(160).optional(),
  techConfig: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
  valueCents: z.number().int().min(0).max(2_000_000_000).optional(),
  monthlyCents: z.number().int().min(0).max(2_000_000_000).optional(),
});

export const listProjects = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input ?? {})
  .handler(async ({ context, data }) => {
    const filter = read(
      z.object({
        q: z.string().max(80).optional(),
        status: projectStatus.optional(),
        clientId: z.string().min(8).optional(),
        archived: z.boolean().optional(),
      }),
      data,
    );
    const sql = await db();
    const params: unknown[] = [context.userId];
    const where = ["p.user_id = $1", filter.archived ? "p.archived_at is not null" : "p.archived_at is null"];
    if (filter.status) {
      params.push(filter.status);
      where.push(`p.status = $${params.length}`);
    }
    if (filter.clientId) {
      params.push(filter.clientId);
      where.push(`p.client_id = $${params.length}`);
    }
    if (filter.q?.trim()) {
      params.push(like(filter.q.trim()));
      where.push(`(p.name ilike $${params.length} escape '\\' or coalesce(c.name, '') ilike $${params.length} escape '\\')`);
    }
    const rows = await sql.query<Row>(
      `${PROJECT_SELECT} where ${where.join(" and ")} order by p.updated_at desc limit 400`,
      params,
    );
    return rows.map(mapProject);
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { id } = read(z.object({ id: z.string().min(8) }), data);
    const sql = await db();
    const userId = context.userId;
    const rows = await sql.query<Row>(`${PROJECT_SELECT} where p.id = $1 and p.user_id = $2`, [id, userId]);
    if (!rows[0]) return null;
    const [updates, contracts, finances, tasks, appointments] = await Promise.all([
      sql.query<Row>(
        `select u.*, p.name as project_name from updates u join projects p on p.id = u.project_id
         where u.user_id = $1 and u.project_id = $2 order by u.happened_on desc, u.created_at desc`,
        [userId, id],
      ),
      sql.query<Row>(`${CONTRACT_SELECT} where ct.user_id = $1 and ct.project_id = $2 order by ct.updated_at desc`, [userId, id]),
      sql.query<Row>(`${FINANCE_SELECT} where f.user_id = $1 and f.project_id = $2 order by f.happened_on desc`, [userId, id]),
      sql.query<Row>(`${TASK_SELECT} where t.user_id = $1 and t.project_id = $2 order by t.done asc, t.due_on asc nulls last`, [userId, id]),
      sql.query<Row>(`${APPT_SELECT} where a.user_id = $1 and a.client_id = $2 order by a.happens_on desc limit 20`, [
        userId,
        rows[0].client_id,
      ]),
    ]);
    return {
      project: mapProject(rows[0]),
      updates: updates.map(mapUpdate),
      contracts: contracts.map((row) => mapContract(row)),
      finances: finances.map(mapFinance),
      tasks: tasks.map(mapTask),
      appointments: rows[0].client_id ? appointments.map(mapAppointment) : [],
    };
  });

export const saveProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const input = read(projectInput, data);
    const sql = await db();
    await assertClient(sql, context.userId, input.clientId);
    const cols = {
      client_id: input.clientId ?? null,
      name: input.name,
      description: input.description ?? "",
      start_date: opt(input.startDate),
      due_date: opt(input.dueDate),
      status: input.status ?? "planejamento",
      url: input.url ?? "",
      repo: input.repo ?? "",
      database_used: input.databaseUsed ?? "",
      database_name: input.databaseName ?? "",
      server: input.server ?? "",
      tech_config: input.techConfig ?? "",
      notes: input.notes ?? "",
      value_cents: input.valueCents ?? 0,
      monthly_cents: input.monthlyCents ?? 0,
    };
    if (input.id) {
      await updateRow(sql, "projects", input.id, context.userId, cols);
      await activity(sql, context.userId, `Projeto atualizado: ${input.name}.`, {
        clientId: input.clientId,
        projectId: input.id,
        kind: "projeto",
      });
      return { id: input.id, created: false };
    }
    const id = nid();
    await insert(sql, "projects", { id, user_id: context.userId, ...cols });
    await activity(sql, context.userId, `Projeto cadastrado: ${input.name}.`, {
      clientId: input.clientId,
      projectId: id,
      kind: "projeto",
    });
    return { id, created: true };
  });

export const setProjectArchived = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const input = read(z.object({ id: z.string().min(8), archived: z.boolean() }), data);
    const sql = await db();
    await updateRow(sql, "projects", input.id, context.userId, {
      archived_at: input.archived ? new Date().toISOString() : null,
    });
    return { ok: true as const };
  });

const updateInput = z.object({
  id: z.string().min(8).optional(),
  projectId: z.string().min(8),
  version: z.string().trim().min(1, "Informe a versão.").max(40),
  happenedOn: day,
  description: z.string().trim().max(4000).optional(),
  bugfix: z.string().trim().max(4000).optional(),
  feature: z.string().trim().max(4000).optional(),
  status: updateStatus.optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const saveUpdate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const input = read(updateInput, data);
    const sql = await db();
    await assertProject(sql, context.userId, input.projectId);
    const cols = {
      project_id: input.projectId,
      version: input.version,
      happened_on: input.happenedOn,
      description: input.description ?? "",
      bugfix: input.bugfix ?? "",
      feature: input.feature ?? "",
      status: input.status ?? "planejada",
      notes: input.notes ?? "",
    };
    if (input.id) {
      const params = [cols.version, cols.happened_on, cols.description, cols.bugfix, cols.feature, cols.status, cols.notes, input.id, context.userId];
      const rows = await sql.query<{ id: string }>(
        `update updates set version = $1, happened_on = $2, description = $3, bugfix = $4, feature = $5, status = $6, notes = $7
         where id = $8 and user_id = $9 returning id`,
        params,
      );
      if (!rows.length) throw new Error("Registro não encontrado.");
      return { id: input.id, created: false };
    }
    const id = nid();
    await insert(sql, "updates", { id, user_id: context.userId, ...cols });
    await activity(sql, context.userId, `Versão ${input.version} registrada.`, { projectId: input.projectId, kind: "versao" });
    return { id, created: true };
  });

export const deleteUpdate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { id } = read(z.object({ id: z.string().min(8) }), data);
    const sql = await db();
    const rows = await sql.query("delete from updates where id = $1 and user_id = $2 returning id", [id, context.userId]);
    if (!rows.length) throw new Error("Registro não encontrado.");
    return { ok: true as const };
  });

const contractInput = z.object({
  id: z.string().min(8).optional(),
  clientId: z.string().min(8).nullable().optional(),
  projectId: z.string().min(8).nullable().optional(),
  type: z.string().trim().min(1, "Informe o tipo do contrato.").max(120),
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  valueCents: z.number().int().min(0).max(2_000_000_000).optional(),
  monthlyCents: z.number().int().min(0).max(2_000_000_000).optional(),
  conditions: z.string().trim().max(8000).optional(),
  notes: z.string().trim().max(4000).optional(),
  status: contractStatus.optional(),
  documentName: z.string().trim().max(180).optional(),
  documentData: z.string().max(280000, "O arquivo passa de 200 KB.").nullable().optional(),
});

export const listContracts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input ?? {})
  .handler(async ({ context, data }) => {
    const filter = read(
      z.object({ status: contractStatus.optional(), archived: z.boolean().optional(), q: z.string().max(80).optional() }),
      data,
    );
    const sql = await db();
    const today = saoPauloToday();
    const params: unknown[] = [context.userId];
    const where = ["ct.user_id = $1", filter.archived ? "ct.archived_at is not null" : "ct.archived_at is null"];
    if (filter.status) {
      params.push(filter.status);
      where.push(`ct.status = $${params.length}`);
    }
    if (filter.q?.trim()) {
      params.push(like(filter.q.trim()));
      where.push(`(ct.type ilike $${params.length} escape '\\' or coalesce(c.name,'') ilike $${params.length} escape '\\' or coalesce(p.name,'') ilike $${params.length} escape '\\')`);
    }
    const rows = await sql.query<Row>(
      `${CONTRACT_SELECT} where ${where.join(" and ")} order by ct.end_date asc nulls last, ct.updated_at desc limit 400`,
      params,
    );
    return { today, soon: addDays(today, 30), contracts: rows.map((row) => mapContract(row)) };
  });

export const getContract = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { id } = read(z.object({ id: z.string().min(8) }), data);
    const sql = await db();
    const rows = await sql.query<Row>(
      `select ct.*, c.name as client_name, p.name as project_name,
              (ct.document_data <> '') as has_document
       from contracts ct
       left join clients c on c.id = ct.client_id and c.user_id = ct.user_id
       left join projects p on p.id = ct.project_id and p.user_id = ct.user_id
       where ct.id = $1 and ct.user_id = $2`,
      [id, context.userId],
    );
    return rows[0] ? mapContract(rows[0], true) : null;
  });

export const saveContract = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const input = read(contractInput, data);
    const sql = await db();
    await assertClient(sql, context.userId, input.clientId);
    await assertProject(sql, context.userId, input.projectId);
    if (input.documentData && !input.documentData.startsWith("data:")) {
      throw new Error("O arquivo enviado não é válido.");
    }
    const cols: Record<string, unknown> = {
      client_id: input.clientId ?? null,
      project_id: input.projectId ?? null,
      type: input.type,
      start_date: opt(input.startDate),
      end_date: opt(input.endDate),
      value_cents: input.valueCents ?? 0,
      monthly_cents: input.monthlyCents ?? 0,
      conditions: input.conditions ?? "",
      notes: input.notes ?? "",
      status: input.status ?? "rascunho",
    };
    if (input.documentData !== undefined) {
      cols.document_name = input.documentData ? (input.documentName ?? "documento") : "";
      cols.document_data = input.documentData ?? "";
    }
    if (input.id) {
      await updateRow(sql, "contracts", input.id, context.userId, cols);
      await activity(sql, context.userId, `Contrato atualizado: ${input.type}.`, {
        clientId: input.clientId,
        projectId: input.projectId,
        kind: "contrato",
      });
      return { id: input.id, created: false };
    }
    const id = nid();
    await insert(sql, "contracts", {
      id,
      user_id: context.userId,
      document_name: "",
      document_data: "",
      ...cols,
    });
    await activity(sql, context.userId, `Contrato criado: ${input.type}.`, {
      clientId: input.clientId,
      projectId: input.projectId,
      kind: "contrato",
    });
    return { id, created: true };
  });

export const setContractArchived = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const input = read(z.object({ id: z.string().min(8), archived: z.boolean() }), data);
    const sql = await db();
    await updateRow(sql, "contracts", input.id, context.userId, {
      archived_at: input.archived ? new Date().toISOString() : null,
    });
    return { ok: true as const };
  });

const financeInput = z.object({
  id: z.string().min(8).optional(),
  kind: financeKind,
  clientId: z.string().min(8).nullable().optional(),
  projectId: z.string().min(8).nullable().optional(),
  category: z.string().trim().max(80).optional(),
  description: z.string().trim().min(1, "Informe a descrição.").max(240),
  amountCents: z.number().int().positive("Informe um valor maior que zero.").max(2_000_000_000),
  happenedOn: day,
  dueOn: day.nullable().optional(),
  paidOn: day.nullable().optional(),
  paymentMethod: z.string().trim().max(60).optional(),
  status: financeStatus.optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const listFinance = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input ?? {})
  .handler(async ({ context, data }) => {
    const filter = read(
      z.object({
        from: day.optional(),
        to: day.optional(),
        kind: financeKind.optional(),
        status: financeStatus.optional(),
        clientId: z.string().min(8).optional(),
      }),
      data,
    );
    const sql = await db();
    const today = saoPauloToday();
    const bounds = monthBounds(today);
    const from = filter.from ?? bounds.start;
    const to = filter.to ?? addDays(bounds.end, -1);
    const params: unknown[] = [context.userId, from, to];
    const where = [
      "f.user_id = $1",
      "coalesce(f.paid_on, f.due_on, f.happened_on) >= $2::date",
      "coalesce(f.paid_on, f.due_on, f.happened_on) <= $3::date",
    ];
    if (filter.kind) {
      params.push(filter.kind);
      where.push(`f.kind = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`f.status = $${params.length}`);
    }
    if (filter.clientId) {
      params.push(filter.clientId);
      where.push(`f.client_id = $${params.length}`);
    }
    const rows = await sql.query<Row>(
      `${FINANCE_SELECT} where ${where.join(" and ")} order by coalesce(f.paid_on, f.happened_on) desc limit 500`,
      params,
    );
    const items = rows.map(mapFinance);
    const received = items.filter((item) => item.kind === "entrada" && item.status === "pago").reduce((sum, item) => sum + item.amountCents, 0);
    const pending = items.filter((item) => item.kind === "entrada" && item.status === "pendente").reduce((sum, item) => sum + item.amountCents, 0);
    const expenses = items.filter((item) => item.kind === "saida" && item.status !== "cancelado").reduce((sum, item) => sum + item.amountCents, 0);
    const yearRows = await sql.query<Row>(
      `select coalesce(sum(amount_cents), 0) as total from finances
       where user_id = $1 and kind = 'entrada' and status = 'pago'
         and coalesce(paid_on, happened_on) >= $2::date and coalesce(paid_on, happened_on) < $3::date`,
      [context.userId, bounds.yearStart, bounds.end],
    );
    const byClientMap = new Map<string, { id: string; name: string; cents: number }>();
    const byProjectMap = new Map<string, { id: string; name: string; cents: number }>();
    for (const item of items) {
      if (item.kind !== "entrada" || item.status === "cancelado") continue;
      if (item.clientId) {
        const current = byClientMap.get(item.clientId) ?? { id: item.clientId, name: item.clientName || "Cliente", cents: 0 };
        current.cents += item.amountCents;
        byClientMap.set(item.clientId, current);
      }
      if (item.projectId) {
        const current = byProjectMap.get(item.projectId) ?? { id: item.projectId, name: item.projectName || "Projeto", cents: 0 };
        current.cents += item.amountCents;
        byProjectMap.set(item.projectId, current);
      }
    }
    return {
      today,
      from,
      to,
      rows: items,
      receivedCents: received,
      pendingCents: pending,
      expenseCents: expenses,
      profitCents: received - items.filter((item) => item.kind === "saida" && item.status === "pago").reduce((sum, item) => sum + item.amountCents, 0),
      yearCents: num(yearRows[0]?.total),
      byClient: [...byClientMap.values()].sort((a, b) => b.cents - a.cents).slice(0, 6),
      byProject: [...byProjectMap.values()].sort((a, b) => b.cents - a.cents).slice(0, 6),
      series: await monthSeries(sql, context.userId, today),
    };
  });

export const saveFinance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const input = read(financeInput, data);
    const sql = await db();
    await assertClient(sql, context.userId, input.clientId);
    await assertProject(sql, context.userId, input.projectId);
    const cols = {
      kind: input.kind,
      client_id: input.clientId ?? null,
      project_id: input.projectId ?? null,
      category: input.category ?? "",
      description: input.description,
      amount_cents: input.amountCents,
      happened_on: input.happenedOn,
      due_on: opt(input.dueOn),
      paid_on: input.status === "pago" ? opt(input.paidOn) ?? input.happenedOn : opt(input.paidOn),
      payment_method: input.paymentMethod ?? "",
      status: input.status ?? "pendente",
      notes: input.notes ?? "",
    };
    if (input.id) {
      await updateRow(sql, "finances", input.id, context.userId, cols);
      return { id: input.id, created: false };
    }
    const id = nid();
    await insert(sql, "finances", { id, user_id: context.userId, ...cols });
    await activity(sql, context.userId, `${input.kind === "entrada" ? "Entrada" : "Saída"} registrada: ${input.description}.`, {
      clientId: input.clientId,
      projectId: input.projectId,
      kind: "financeiro",
    });
    return { id, created: true };
  });

export const setFinanceStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const input = read(z.object({ id: z.string().min(8), status: financeStatus }), data);
    const sql = await db();
    const today = saoPauloToday();
    const rows = await sql.query<Row>("select kind from finances where id = $1 and user_id = $2", [input.id, context.userId]);
    if (!rows[0]) throw new Error("Registro não encontrado.");
    await updateRow(sql, "finances", input.id, context.userId, {
      status: input.status,
      paid_on: input.status === "pago" ? today : null,
    });
    return { ok: true as const, kind: str(rows[0].kind) as FinanceKind };
  });

export const deleteFinance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { id } = read(z.object({ id: z.string().min(8) }), data);
    const sql = await db();
    const rows = await sql.query("delete from finances where id = $1 and user_id = $2 returning id", [id, context.userId]);
    if (!rows.length) throw new Error("Registro não encontrado.");
    return { ok: true as const };
  });

const taskInput = z.object({
  id: z.string().min(8).optional(),
  scope: taskScope.optional(),
  title: z.string().trim().min(1, "Informe o título.").max(180),
  description: z.string().trim().max(4000).optional(),
  dueOn: day.nullable().optional(),
  dueTime: clock.optional().or(z.literal("")),
  priority: priority.optional(),
  category: z.string().trim().max(80).optional(),
  clientId: z.string().min(8).nullable().optional(),
  projectId: z.string().min(8).nullable().optional(),
  done: z.boolean().optional(),
});

export const listTasks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input ?? {})
  .handler(async ({ context, data }) => {
    const filter = read(
      z.object({
        scope: taskScope.optional(),
        done: z.boolean().optional(),
        clientId: z.string().min(8).optional(),
      }),
      data,
    );
    const sql = await db();
    const params: unknown[] = [context.userId];
    const where = ["t.user_id = $1"];
    if (filter.scope) {
      params.push(filter.scope);
      where.push(`t.scope = $${params.length}`);
    }
    if (filter.done !== undefined) {
      params.push(filter.done);
      where.push(`t.done = $${params.length}`);
    }
    if (filter.clientId) {
      params.push(filter.clientId);
      where.push(`t.client_id = $${params.length}`);
    }
    const rows = await sql.query<Row>(
      `${TASK_SELECT} where ${where.join(" and ")}
       order by t.done asc, case t.priority when 'alta' then 0 when 'normal' then 1 else 2 end, t.due_on asc nulls last
       limit 400`,
      params,
    );
    return { today: saoPauloToday(), tasks: rows.map(mapTask) };
  });

export const saveTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const input = read(taskInput, data);
    const sql = await db();
    await assertClient(sql, context.userId, input.clientId);
    await assertProject(sql, context.userId, input.projectId);
    const cols = {
      scope: input.scope ?? "empresa",
      title: input.title,
      description: input.description ?? "",
      due_on: opt(input.dueOn),
      due_time: input.dueTime ?? "",
      priority: input.priority ?? "normal",
      category: input.category ?? "",
      client_id: input.clientId ?? null,
      project_id: input.projectId ?? null,
      done: input.done ?? false,
    };
    if (input.id) {
      await updateRow(sql, "tasks", input.id, context.userId, cols);
      return { id: input.id, created: false };
    }
    const id = nid();
    await insert(sql, "tasks", { id, user_id: context.userId, ...cols });
    await activity(sql, context.userId, `Tarefa criada: ${input.title}.`, {
      clientId: input.clientId,
      projectId: input.projectId,
      kind: "tarefa",
    });
    return { id, created: true };
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { id } = read(z.object({ id: z.string().min(8) }), data);
    const sql = await db();
    const rows = await sql.query<Row>(
      "update tasks set done = not done, updated_at = now() where id = $1 and user_id = $2 returning done, title",
      [id, context.userId],
    );
    if (!rows[0]) throw new Error("Registro não encontrado.");
    return { done: flag(rows[0].done), title: str(rows[0].title) };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { id } = read(z.object({ id: z.string().min(8) }), data);
    const sql = await db();
    const rows = await sql.query("delete from tasks where id = $1 and user_id = $2 returning id", [id, context.userId]);
    if (!rows.length) throw new Error("Registro não encontrado.");
    return { ok: true as const };
  });

const appointmentInput = z.object({
  id: z.string().min(8).optional(),
  title: z.string().trim().min(1, "Informe o título.").max(180),
  happensOn: day,
  startsAt: clock.optional().or(z.literal("")),
  durationMin: z.number().int().min(15).max(720).optional(),
  clientId: z.string().min(8).nullable().optional(),
  location: z.string().trim().max(180).optional(),
  notes: z.string().trim().max(4000).optional(),
  status: appointmentStatus.optional(),
});

export const listAppointments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input ?? {})
  .handler(async ({ context, data }) => {
    const filter = read(z.object({ from: day.optional(), to: day.optional() }), data);
    const sql = await db();
    const today = saoPauloToday();
    const from = filter.from ?? addDays(today, -7);
    const to = filter.to ?? addDays(today, 45);
    const rows = await sql.query<Row>(
      `${APPT_SELECT} where a.user_id = $1 and a.happens_on >= $2::date and a.happens_on <= $3::date
       order by a.happens_on asc, a.starts_at asc limit 400`,
      [context.userId, from, to],
    );
    return { today, from, to, appointments: rows.map(mapAppointment) };
  });

export const saveAppointment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const input = read(appointmentInput, data);
    const sql = await db();
    await assertClient(sql, context.userId, input.clientId);
    const cols = {
      title: input.title,
      happens_on: input.happensOn,
      starts_at: input.startsAt ?? "",
      duration_min: input.durationMin ?? 60,
      client_id: input.clientId ?? null,
      location: input.location ?? "",
      notes: input.notes ?? "",
      status: input.status ?? "agendado",
    };
    if (input.id) {
      await updateRow(sql, "appointments", input.id, context.userId, cols);
      return { id: input.id, created: false };
    }
    const id = nid();
    await insert(sql, "appointments", { id, user_id: context.userId, ...cols });
    await activity(sql, context.userId, `Compromisso criado: ${input.title}.`, { clientId: input.clientId, kind: "agenda" });
    return { id, created: true, happensOn: input.happensOn, startsAt: input.startsAt ?? "" };
  });

export const deleteAppointment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const { id } = read(z.object({ id: z.string().min(8) }), data);
    const sql = await db();
    const rows = await sql.query("delete from appointments where id = $1 and user_id = $2 returning id", [id, context.userId]);
    if (!rows.length) throw new Error("Registro não encontrado.");
    return { ok: true as const };
  });

export const globalSearch = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input ?? {})
  .handler(async ({ context, data }) => {
    const { q } = read(z.object({ q: z.string().max(80).optional() }), data);
    const query = q?.trim() ?? "";
    if (query.length < 2) return { hits: [] as SearchHit[] };
    const sql = await db();
    const userId = context.userId;
    const pattern = like(query);
    const [clients, projects, contracts, updates, tasks, appointments] = await Promise.all([
      sql.query<Row>(
        "select id, name, company from clients where user_id = $1 and archived_at is null and (name ilike $2 escape '\\' or company ilike $2 escape '\\' or email ilike $2 escape '\\') order by name limit 8",
        [userId, pattern],
      ),
      sql.query<Row>(
        "select id, name, status from projects where user_id = $1 and archived_at is null and (name ilike $2 escape '\\' or description ilike $2 escape '\\') order by name limit 8",
        [userId, pattern],
      ),
      sql.query<Row>(
        "select id, type, status from contracts where user_id = $1 and archived_at is null and (type ilike $2 escape '\\' or notes ilike $2 escape '\\') order by updated_at desc limit 8",
        [userId, pattern],
      ),
      sql.query<Row>(
        `select u.id, u.version, u.description, u.project_id, p.name as project_name
         from updates u join projects p on p.id = u.project_id
         where u.user_id = $1 and (u.version ilike $2 escape '\\' or u.description ilike $2 escape '\\' or u.feature ilike $2 escape '\\' or u.bugfix ilike $2 escape '\\')
         order by u.happened_on desc limit 8`,
        [userId, pattern],
      ),
      sql.query<Row>(
        "select id, title, scope from tasks where user_id = $1 and (title ilike $2 escape '\\' or description ilike $2 escape '\\') order by done asc, due_on asc nulls last limit 8",
        [userId, pattern],
      ),
      sql.query<Row>(
        "select id, title, happens_on from appointments where user_id = $1 and (title ilike $2 escape '\\' or location ilike $2 escape '\\' or notes ilike $2 escape '\\') order by happens_on desc limit 8",
        [userId, pattern],
      ),
    ]);
    const hits: SearchHit[] = [
      ...clients.map((row) => ({ kind: "cliente" as const, id: str(row.id), title: str(row.name), subtitle: str(row.company), href: `/clientes/${str(row.id)}` })),
      ...projects.map((row) => ({ kind: "projeto" as const, id: str(row.id), title: str(row.name), subtitle: str(row.status), href: `/projetos/${str(row.id)}` })),
      ...contracts.map((row) => ({ kind: "contrato" as const, id: str(row.id), title: str(row.type), subtitle: str(row.status), href: `/contratos?id=${str(row.id)}` })),
      ...updates.map((row) => ({ kind: "atualizacao" as const, id: str(row.id), title: `${str(row.project_name)} · ${str(row.version)}`, subtitle: str(row.description), href: `/projetos/${str(row.project_id)}` })),
      ...tasks.map((row) => ({ kind: "tarefa" as const, id: str(row.id), title: str(row.title), subtitle: str(row.scope), href: "/tarefas" })),
      ...appointments.map((row) => ({ kind: "agenda" as const, id: str(row.id), title: str(row.title), subtitle: dateOf(row.happens_on) ?? "", href: "/agenda" })),
    ];
    return { hits };
  });

const textField = z.string().max(8000);
const backupClient = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  company: textField.optional(),
  phone: z.string().max(40).optional(),
  whatsapp: z.string().max(40).optional(),
  email: z.string().max(160).optional(),
  segment: z.string().max(80).optional(),
  document: z.string().max(32).optional(),
  address: z.string().max(300).optional(),
  status: clientStatus.optional(),
  notes: textField.optional(),
  extra: textField.optional(),
});
const backupProject = z.object({
  id: z.string().min(1).max(80),
  clientId: z.string().max(80).nullable().optional(),
  name: z.string().min(1).max(160),
  description: textField.optional(),
  startDate: day.nullable().optional(),
  dueDate: day.nullable().optional(),
  status: projectStatus.optional(),
  url: z.string().max(300).optional(),
  repo: z.string().max(300).optional(),
  databaseUsed: z.string().max(80).optional(),
  databaseName: z.string().max(120).optional(),
  server: z.string().max(160).optional(),
  techConfig: textField.optional(),
  notes: textField.optional(),
  valueCents: z.number().int().min(0).max(2_000_000_000).optional(),
  monthlyCents: z.number().int().min(0).max(2_000_000_000).optional(),
});
const backupSchema = z.object({
  version: z.literal(1),
  clients: z.array(backupClient).max(500),
  projects: z.array(backupProject).max(500),
  updates: z.array(z.object({
    id: z.string().min(1).max(80),
    projectId: z.string().min(1).max(80),
    version: z.string().min(1).max(40),
    happenedOn: day,
    description: textField.optional(),
    bugfix: textField.optional(),
    feature: textField.optional(),
    status: updateStatus.optional(),
    notes: textField.optional(),
  })).max(2000),
  contracts: z.array(z.object({
    id: z.string().min(1).max(80),
    clientId: z.string().max(80).nullable().optional(),
    projectId: z.string().max(80).nullable().optional(),
    type: z.string().min(1).max(120),
    startDate: day.nullable().optional(),
    endDate: day.nullable().optional(),
    valueCents: z.number().int().min(0).optional(),
    monthlyCents: z.number().int().min(0).optional(),
    conditions: textField.optional(),
    notes: textField.optional(),
    status: contractStatus.optional(),
    documentName: z.string().max(180).optional(),
    documentData: z.string().max(280000).optional(),
  })).max(500),
  finances: z.array(z.object({
    id: z.string().min(1).max(80),
    kind: financeKind,
    clientId: z.string().max(80).nullable().optional(),
    projectId: z.string().max(80).nullable().optional(),
    category: z.string().max(80).optional(),
    description: z.string().min(1).max(240),
    amountCents: z.number().int().positive(),
    happenedOn: day,
    dueOn: day.nullable().optional(),
    paidOn: day.nullable().optional(),
    paymentMethod: z.string().max(60).optional(),
    status: financeStatus.optional(),
    notes: textField.optional(),
  })).max(2000),
  tasks: z.array(z.object({
    id: z.string().min(1).max(80),
    scope: taskScope.optional(),
    title: z.string().min(1).max(180),
    description: textField.optional(),
    dueOn: day.nullable().optional(),
    dueTime: z.string().max(5).optional(),
    priority: priority.optional(),
    category: z.string().max(80).optional(),
    clientId: z.string().max(80).nullable().optional(),
    projectId: z.string().max(80).nullable().optional(),
    done: z.boolean().optional(),
  })).max(2000),
  appointments: z.array(z.object({
    id: z.string().min(1).max(80),
    title: z.string().min(1).max(180),
    happensOn: day,
    startsAt: z.string().max(5).optional(),
    durationMin: z.number().int().min(0).max(1440).optional(),
    clientId: z.string().max(80).nullable().optional(),
    location: z.string().max(180).optional(),
    notes: textField.optional(),
    status: appointmentStatus.optional(),
  })).max(2000),
});

export const exportBackup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const userId = context.userId;
    const [clients, projects, updates, contracts, finances, tasks, appointments] = await Promise.all([
      sql.query<Row>("select * from clients where user_id = $1 and archived_at is null", [userId]),
      sql.query<Row>("select * from projects where user_id = $1 and archived_at is null", [userId]),
      sql.query<Row>("select * from updates where user_id = $1", [userId]),
      sql.query<Row>("select * from contracts where user_id = $1 and archived_at is null", [userId]),
      sql.query<Row>("select * from finances where user_id = $1", [userId]),
      sql.query<Row>("select * from tasks where user_id = $1", [userId]),
      sql.query<Row>("select * from appointments where user_id = $1", [userId]),
    ]);
    return {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      clients: clients.map((row) => ({
        id: str(row.id), name: str(row.name), company: str(row.company), phone: str(row.phone),
        whatsapp: str(row.whatsapp), email: str(row.email), segment: str(row.segment),
        document: str(row.document), address: str(row.address), status: str(row.status),
        notes: str(row.notes), extra: str(row.extra),
      })),
      projects: projects.map((row) => ({
        id: str(row.id), clientId: row.client_id ? str(row.client_id) : null, name: str(row.name),
        description: str(row.description), startDate: dateOf(row.start_date), dueDate: dateOf(row.due_date),
        status: str(row.status), url: str(row.url), repo: str(row.repo), databaseUsed: str(row.database_used),
        databaseName: str(row.database_name), server: str(row.server), techConfig: str(row.tech_config),
        notes: str(row.notes), valueCents: num(row.value_cents), monthlyCents: num(row.monthly_cents),
      })),
      updates: updates.map((row) => ({
        id: str(row.id), projectId: str(row.project_id), version: str(row.version), happenedOn: dateOf(row.happened_on),
        description: str(row.description), bugfix: str(row.bugfix), feature: str(row.feature),
        status: str(row.status), notes: str(row.notes),
      })),
      contracts: contracts.map((row) => ({
        id: str(row.id), clientId: row.client_id ? str(row.client_id) : null, projectId: row.project_id ? str(row.project_id) : null,
        type: str(row.type), startDate: dateOf(row.start_date), endDate: dateOf(row.end_date),
        valueCents: num(row.value_cents), monthlyCents: num(row.monthly_cents), conditions: str(row.conditions),
        notes: str(row.notes), status: str(row.status), documentName: str(row.document_name), documentData: str(row.document_data),
      })),
      finances: finances.map((row) => ({
        id: str(row.id), kind: str(row.kind), clientId: row.client_id ? str(row.client_id) : null,
        projectId: row.project_id ? str(row.project_id) : null, category: str(row.category),
        description: str(row.description), amountCents: num(row.amount_cents), happenedOn: dateOf(row.happened_on),
        dueOn: dateOf(row.due_on), paidOn: dateOf(row.paid_on), paymentMethod: str(row.payment_method),
        status: str(row.status), notes: str(row.notes),
      })),
      tasks: tasks.map((row) => ({
        id: str(row.id), scope: str(row.scope), title: str(row.title), description: str(row.description),
        dueOn: dateOf(row.due_on), dueTime: str(row.due_time), priority: str(row.priority), category: str(row.category),
        clientId: row.client_id ? str(row.client_id) : null, projectId: row.project_id ? str(row.project_id) : null,
        done: flag(row.done),
      })),
      appointments: appointments.map((row) => ({
        id: str(row.id), title: str(row.title), happensOn: dateOf(row.happens_on), startsAt: str(row.starts_at),
        durationMin: num(row.duration_min), clientId: row.client_id ? str(row.client_id) : null,
        location: str(row.location), notes: str(row.notes), status: str(row.status),
      })),
    };
  });

function parseBackup(input: unknown) {
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) throw new Error("O arquivo não é um backup válido do Nexo.");
  return parsed.data;
}

export const previewImport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const body = read(z.object({ payload: z.unknown() }), data);
    const backup = parseBackup(body.payload);
    return {
      ok: true as const,
      counts: {
        clients: backup.clients.length,
        projects: backup.projects.length,
        updates: backup.updates.length,
        contracts: backup.contracts.length,
        finances: backup.finances.length,
        tasks: backup.tasks.length,
        appointments: backup.appointments.length,
      },
    };
  });

export const importBackup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const body = read(z.object({ payload: z.unknown(), mode: z.enum(["merge", "replace"]) }), data);
    const backup = parseBackup(body.payload);
    const sql = await db();
    const userId = context.userId;
    if (body.mode === "replace") {
      await sql.query("delete from assistant_messages where user_id = $1", [userId]);
      await sql.query("delete from activities where user_id = $1", [userId]);
      await sql.query("delete from updates where user_id = $1", [userId]);
      await sql.query("delete from finances where user_id = $1", [userId]);
      await sql.query("delete from tasks where user_id = $1", [userId]);
      await sql.query("delete from appointments where user_id = $1", [userId]);
      await sql.query("delete from contracts where user_id = $1", [userId]);
      await sql.query("delete from projects where user_id = $1", [userId]);
      await sql.query("delete from clients where user_id = $1", [userId]);
    }
    const clients = new Map<string, string>();
    const projects = new Map<string, string>();
    for (const item of backup.clients) {
      const id = nid();
      clients.set(item.id, id);
      await insert(sql, "clients", {
        id, user_id: userId, name: item.name, company: item.company ?? "", phone: item.phone ?? "",
        whatsapp: item.whatsapp ?? "", email: item.email ?? "", segment: item.segment ?? "",
        document: item.document ?? "", address: item.address ?? "", status: item.status ?? "ativo",
        notes: item.notes ?? "", extra: item.extra ?? "",
      });
    }
    const mapId = (table: Map<string, string>, value: string | null | undefined) => {
      if (!value) return null;
      return table.get(value) ?? null;
    };
    for (const item of backup.projects) {
      const id = nid();
      projects.set(item.id, id);
      await insert(sql, "projects", {
        id, user_id: userId, client_id: mapId(clients, item.clientId), name: item.name,
        description: item.description ?? "", start_date: item.startDate ?? null, due_date: item.dueDate ?? null,
        status: item.status ?? "planejamento", url: item.url ?? "", repo: item.repo ?? "",
        database_used: item.databaseUsed ?? "", database_name: item.databaseName ?? "", server: item.server ?? "",
        tech_config: item.techConfig ?? "", notes: item.notes ?? "",
        value_cents: item.valueCents ?? 0, monthly_cents: item.monthlyCents ?? 0,
      });
    }
    for (const item of backup.updates) {
      const projectId = mapId(projects, item.projectId);
      if (!projectId) continue;
      await insert(sql, "updates", {
        id: nid(), user_id: userId, project_id: projectId, version: item.version, happened_on: item.happenedOn,
        description: item.description ?? "", bugfix: item.bugfix ?? "", feature: item.feature ?? "",
        status: item.status ?? "planejada", notes: item.notes ?? "",
      });
    }
    for (const item of backup.contracts) {
      await insert(sql, "contracts", {
        id: nid(), user_id: userId, client_id: mapId(clients, item.clientId), project_id: mapId(projects, item.projectId),
        type: item.type, start_date: item.startDate ?? null, end_date: item.endDate ?? null,
        value_cents: item.valueCents ?? 0, monthly_cents: item.monthlyCents ?? 0,
        conditions: item.conditions ?? "", notes: item.notes ?? "", status: item.status ?? "rascunho",
        document_name: item.documentName ?? "", document_data: item.documentData ?? "",
      });
    }
    for (const item of backup.finances) {
      await insert(sql, "finances", {
        id: nid(), user_id: userId, kind: item.kind, client_id: mapId(clients, item.clientId),
        project_id: mapId(projects, item.projectId), category: item.category ?? "", description: item.description,
        amount_cents: item.amountCents, happened_on: item.happenedOn, due_on: item.dueOn ?? null,
        paid_on: item.paidOn ?? null, payment_method: item.paymentMethod ?? "", status: item.status ?? "pendente",
        notes: item.notes ?? "",
      });
    }
    for (const item of backup.tasks) {
      await insert(sql, "tasks", {
        id: nid(), user_id: userId, scope: item.scope ?? "empresa", title: item.title, description: item.description ?? "",
        due_on: item.dueOn ?? null, due_time: item.dueTime ?? "", priority: item.priority ?? "normal",
        category: item.category ?? "", client_id: mapId(clients, item.clientId), project_id: mapId(projects, item.projectId),
        done: item.done ?? false,
      });
    }
    for (const item of backup.appointments) {
      await insert(sql, "appointments", {
        id: nid(), user_id: userId, title: item.title, happens_on: item.happensOn, starts_at: item.startsAt ?? "",
        duration_min: item.durationMin || 60, client_id: mapId(clients, item.clientId), location: item.location ?? "",
        notes: item.notes ?? "", status: item.status ?? "agendado",
      });
    }
    await activity(sql, userId, body.mode === "replace" ? "Backup importado no lugar dos dados atuais." : "Backup importado e acrescentado.", { kind: "backup" });
    return { ok: true as const };
  });

export const seedDemo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const userId = context.userId;
    const existing = await sql.query<Row>("select count(*) as n from clients where user_id = $1", [userId]);
    if (num(existing[0]?.n) > 0) throw new Error("O exemplo só entra numa conta que ainda não tem clientes.");
    const today = saoPauloToday();
    const jessica = nid();
    const gabriel = nid();
    const marina = nid();
    const carlos = nid();
    const barbearia = nid();
    const atelier = nid();
    const pedidos = nid();
    const people = [
      { id: jessica, name: "Jéssica Almeida", company: "Barbearia Almeida", phone: "(11) 98800-1001", whatsapp: "5511988001001", email: "jessica@barbeariaalmeida.example", segment: "Beleza", status: "ativo", notes: "Cliente recorrente. Prefere contato por WhatsApp." },
      { id: gabriel, name: "Gabriel Mendes", company: "Gabriel & Co", phone: "(11) 98800-1002", whatsapp: "5511988001002", email: "gabriel@gabrielco.example", segment: "Serviços", status: "negociacao", notes: "Proposta da agenda enviada. Quer falar da barbearia amanhã." },
      { id: marina, name: "Marina Duarte", company: "Ateliê Vértice", phone: "(21) 97700-2003", whatsapp: "5521977002003", email: "marina@atelievertice.example", segment: "Moda", status: "ativo", notes: "Site em construção. Pagamento da entrada ainda pendente." },
      { id: carlos, name: "Carlos Pires", company: "Oficina Lume", phone: "(31) 96600-3004", whatsapp: "", email: "carlos@oficinalume.example", segment: "Automotivo", status: "inativo", notes: "Projeto entregue em 2025. Sem contrato vigente." },
    ];
    for (const person of people) {
      await insert(sql, "clients", {
        id: person.id, user_id: userId, name: person.name, company: person.company, phone: person.phone,
        whatsapp: person.whatsapp, email: person.email, segment: person.segment, document: "", address: "",
        status: person.status, notes: person.notes, extra: "",
      });
    }
    await insert(sql, "projects", {
      id: barbearia, user_id: userId, client_id: jessica, name: "Agenda da Barbearia",
      description: "Aplicativo de agendamento, comanda e lembretes de retorno.",
      start_date: addDays(today, -120), due_date: null, status: "manutencao",
      url: "https://agenda.barbeariaalmeida.example", repo: "github.com/estudio/agenda-barbearia",
      database_used: "PostgreSQL", database_name: "barbearia_app", server: "Fly.io",
      tech_config: "React, API Node, Postgres", notes: "Mensalidade de suporte.",
      value_cents: 1200000, monthly_cents: 45000,
    });
    await insert(sql, "projects", {
      id: atelier, user_id: userId, client_id: marina, name: "Site Ateliê Vértice",
      description: "Vitrine, lista de espera e painel simples de pedidos.",
      start_date: addDays(today, -20), due_date: addDays(today, 25), status: "andamento",
      url: "", repo: "github.com/estudio/atelie-vertice", database_used: "PostgreSQL",
      database_name: "atelie", server: "Vercel", tech_config: "", notes: "Aguardando fotos finais.",
      value_cents: 680000, monthly_cents: 0,
    });
    await insert(sql, "projects", {
      id: pedidos, user_id: userId, client_id: gabriel, name: "App de pedidos",
      description: "Proposta ainda em planejamento para o novo ponto do Gabriel.",
      start_date: today, due_date: addDays(today, 60), status: "planejamento",
      url: "", repo: "", database_used: "", database_name: "", server: "", tech_config: "", notes: "",
      value_cents: 0, monthly_cents: 0,
    });
    await insert(sql, "updates", {
      id: nid(), user_id: userId, project_id: barbearia, version: "1.2.0", happened_on: addDays(today, -18),
      description: "Lembrete de retorno e ajuste da agenda no celular.", bugfix: "Horário duplicado ao remarcar.",
      feature: "Confirmação pelo WhatsApp.", status: "entregue", notes: "",
    });
    await insert(sql, "updates", {
      id: nid(), user_id: userId, project_id: barbearia, version: "1.3.0", happened_on: today,
      description: "Pacotes de serviço e comissão do barbeiro.", bugfix: "", feature: "Pacotes mensais.",
      status: "andamento", notes: "Ainda falta o relatório.",
    });
    await insert(sql, "contracts", {
      id: nid(), user_id: userId, client_id: jessica, project_id: barbearia, type: "Suporte mensal",
      start_date: addDays(today, -40), end_date: addDays(today, 22), value_cents: 0, monthly_cents: 45000,
      conditions: "Até 6 horas de manutenção por mês.", notes: "", status: "assinado", document_name: "", document_data: "",
    });
    await insert(sql, "contracts", {
      id: nid(), user_id: userId, client_id: gabriel, project_id: pedidos, type: "Proposta de desenvolvimento",
      start_date: today, end_date: addDays(today, 15), value_cents: 980000, monthly_cents: 0,
      conditions: "Válida por 15 dias.", notes: "", status: "aguardando", document_name: "", document_data: "",
    });
    const financeRows = [
      { kind: "entrada", client: jessica, project: barbearia, category: "Mensalidade", description: "Mensalidade da barbearia", amount: 45000, on: addDays(today, -2), status: "pago", method: "Pix" },
      { kind: "entrada", client: marina, project: atelier, category: "Projeto", description: "Entrada do site do ateliê", amount: 340000, on: addDays(today, 4), status: "pendente", method: "Boleto" },
      { kind: "saida", client: null, project: null, category: "Ferramentas", description: "Assinatura de ferramentas", amount: 8900, on: addDays(today, -1), status: "pago", method: "Cartão" },
      { kind: "entrada", client: jessica, project: barbearia, category: "Mensalidade", description: "Mensalidade anterior", amount: 45000, on: addDays(today, -32), status: "pago", method: "Pix" },
    ];
    for (const item of financeRows) {
      await insert(sql, "finances", {
        id: nid(), user_id: userId, kind: item.kind, client_id: item.client, project_id: item.project,
        category: item.category, description: item.description, amount_cents: item.amount,
        happened_on: item.on, due_on: item.status === "pendente" ? item.on : null,
        paid_on: item.status === "pago" ? item.on : null, payment_method: item.method, status: item.status, notes: "",
      });
    }
    await insert(sql, "tasks", {
      id: nid(), user_id: userId, scope: "empresa", title: "Ligar para a Jéssica", description: "Confirmar o pacote 1.3 da agenda.",
      due_on: addDays(today, 1), due_time: "10:00", priority: "alta", category: "Relacionamento",
      client_id: jessica, project_id: barbearia, done: false,
    });
    await insert(sql, "tasks", {
      id: nid(), user_id: userId, scope: "empresa", title: "Revisar proposta do Gabriel", description: "",
      due_on: today, due_time: "", priority: "normal", category: "Comercial", client_id: gabriel, project_id: pedidos, done: false,
    });
    await insert(sql, "tasks", {
      id: nid(), user_id: userId, scope: "pessoal", title: "Pagar a Vivo", description: "",
      due_on: addDays(today, 2), due_time: "", priority: "normal", category: "Contas", client_id: null, project_id: null, done: false,
    });
    await insert(sql, "appointments", {
      id: nid(), user_id: userId, title: "Conversa com Gabriel sobre a barbearia", happens_on: addDays(today, 1),
      starts_at: "14:00", duration_min: 60, client_id: gabriel, location: "Café na Vila Madalena", notes: "Levar a proposta impressa.", status: "agendado",
    });
    await activity(sql, userId, "Dados de exemplo carregados.", { kind: "sistema" });
    return { ok: true as const };
  });

const hits = new Map<string, number[]>();

function rateLimit(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((stamp) => now - stamp < 3_600_000);
  if (recent.length >= 30) throw new Error("Muitas consultas ao assistente. Tente novamente em alguns minutos.");
  recent.push(now);
  hits.set(userId, recent);
}

const optionalName = z.string().trim().max(160).optional();
const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_client"),
    name: z.string().trim().min(1).max(160),
    company: optionalName,
    phone: z.string().max(40).optional(),
    whatsapp: z.string().max(40).optional(),
    email: z.string().max(160).optional(),
    segment: z.string().max(80).optional(),
    status: clientStatus.optional(),
    notes: z.string().max(2000).optional(),
  }),
  z.object({
    type: z.literal("update_client"),
    name: z.string().trim().min(1).max(160),
    status: clientStatus.optional(),
    phone: z.string().max(40).optional(),
    company: optionalName,
    notes: z.string().max(2000).optional(),
  }),
  z.object({
    type: z.literal("create_project"),
    name: z.string().trim().min(1).max(160),
    clientName: optionalName,
    description: z.string().max(2000).optional(),
    status: projectStatus.optional(),
    value: z.union([z.number(), z.string()]).optional(),
    monthly: z.union([z.number(), z.string()]).optional(),
    due: day.optional(),
  }),
  z.object({
    type: z.literal("update_project"),
    name: z.string().trim().min(1).max(160),
    status: projectStatus,
  }),
  z.object({
    type: z.literal("create_update"),
    projectName: z.string().trim().min(1).max(160),
    version: z.string().trim().min(1).max(40),
    description: z.string().max(2000).optional(),
    bugfix: z.string().max(2000).optional(),
    feature: z.string().max(2000).optional(),
    status: updateStatus.optional(),
    date: day.optional(),
  }),
  z.object({
    type: z.literal("create_contract"),
    clientName: z.string().trim().min(1).max(160),
    projectName: optionalName,
    contractType: z.string().trim().min(1).max(120),
    value: z.union([z.number(), z.string()]).optional(),
    monthly: z.union([z.number(), z.string()]).optional(),
    startDate: day.optional(),
    endDate: day.optional(),
    status: contractStatus.optional(),
  }),
  z.object({
    type: z.literal("create_finance"),
    kind: financeKind,
    amount: z.union([z.number(), z.string()]),
    description: z.string().trim().min(1).max(240),
    date: day.optional(),
    dueDate: day.optional(),
    status: financeStatus.optional(),
    clientName: optionalName,
    projectName: optionalName,
    category: z.string().max(80).optional(),
    paymentMethod: z.string().max(60).optional(),
  }),
  z.object({
    type: z.literal("create_task"),
    title: z.string().trim().min(1).max(180),
    description: z.string().max(2000).optional(),
    date: day.optional(),
    time: clock.optional(),
    priority: priority.optional(),
    scope: taskScope.optional(),
    category: z.string().max(80).optional(),
    clientName: optionalName,
    projectName: optionalName,
  }),
  z.object({
    type: z.literal("create_appointment"),
    title: z.string().trim().min(1).max(180),
    date: day,
    time: clock.optional(),
    durationMin: z.number().int().min(15).max(720).optional(),
    clientName: optionalName,
    location: z.string().max(180).optional(),
    notes: z.string().max(2000).optional(),
  }),
]);

type Action = z.infer<typeof actionSchema>;

function reais(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 20_000_000) throw new Error("Valor inválido.");
  return Math.round(n * 100);
}

async function resolveNamed(
  sql: Sql,
  userId: string,
  table: "clients" | "projects",
  name: string,
): Promise<{ id: string; name: string; client_id?: string | null }> {
  const column = table === "clients" ? "name, company" : "name, ''";
  const rows = await sql.query<Row>(
    `select id, name${table === "projects" ? ", client_id" : ""} from ${table}
     where user_id = $1 and archived_at is null and (${column.split(", ")[0]} ilike $2 or ${table === "clients" ? "company" : "name"} ilike $2)
     order by length(name) asc limit 5`,
    [userId, like(name.trim())],
  );
  if (!rows.length) throw new Error(`Não encontrei “${name}”.`);
  const wanted = name.trim().toLowerCase();
  const exact = rows.filter((row) => str(row.name).toLowerCase() === wanted);
  const chosen = exact[0] ?? (rows.length === 1 ? rows[0] : null);
  if (!chosen) throw new Error(`Há mais de um registro parecido com “${name}”.`);
  return { id: str(chosen.id), name: str(chosen.name), client_id: chosen.client_id ? str(chosen.client_id) : null };
}

async function runAction(sql: Sql, userId: string, action: Action, today: string): Promise<string> {
  if (action.type === "create_client") {
    const id = nid();
    await insert(sql, "clients", {
      id, user_id: userId, name: action.name, company: action.company ?? "", phone: action.phone ?? "",
      whatsapp: action.whatsapp ?? "", email: action.email ?? "", segment: action.segment ?? "",
      document: "", address: "", status: action.status ?? "ativo", notes: action.notes ?? "", extra: "",
    });
    await activity(sql, userId, `Cliente cadastrado: ${action.name}.`, { clientId: id, kind: "cliente" });
    return `Cliente cadastrado com sucesso: ${action.name}.`;
  }
  if (action.type === "update_client") {
    const client = await resolveNamed(sql, userId, "clients", action.name);
    const cols: Record<string, unknown> = {};
    if (action.status) cols.status = action.status;
    if (action.phone) cols.phone = action.phone;
    if (action.company) cols.company = action.company;
    if (action.notes) cols.notes = action.notes;
    if (!Object.keys(cols).length) throw new Error("Diga o que deve mudar nesse cliente.");
    await updateRow(sql, "clients", client.id, userId, cols);
    return `Cliente ${client.name} atualizado.`;
  }
  if (action.type === "create_project") {
    const client = action.clientName ? await resolveNamed(sql, userId, "clients", action.clientName) : null;
    const id = nid();
    await insert(sql, "projects", {
      id, user_id: userId, client_id: client?.id ?? null, name: action.name, description: action.description ?? "",
      start_date: today, due_date: action.due ?? null, status: action.status ?? "planejamento",
      url: "", repo: "", database_used: "", database_name: "", server: "", tech_config: "", notes: "",
      value_cents: action.value != null ? reais(action.value) : 0,
      monthly_cents: action.monthly != null ? reais(action.monthly) : 0,
    });
    await activity(sql, userId, `Projeto cadastrado: ${action.name}.`, { clientId: client?.id, projectId: id, kind: "projeto" });
    return `Projeto cadastrado: ${action.name}.`;
  }
  if (action.type === "update_project") {
    const project = await resolveNamed(sql, userId, "projects", action.name);
    await updateRow(sql, "projects", project.id, userId, { status: action.status });
    const label = { planejamento: "planejamento", andamento: "em andamento", entregue: "entregue", manutencao: "manutenção", pausado: "pausado" }[action.status];
    return `Projeto ${project.name} alterado para ${label}.`;
  }
  if (action.type === "create_update") {
    const project = await resolveNamed(sql, userId, "projects", action.projectName);
    await insert(sql, "updates", {
      id: nid(), user_id: userId, project_id: project.id, version: action.version, happened_on: action.date ?? today,
      description: action.description ?? "", bugfix: action.bugfix ?? "", feature: action.feature ?? "",
      status: action.status ?? "planejada", notes: "",
    });
    return `Atualização ${action.version} registrada em ${project.name}.`;
  }
  if (action.type === "create_contract") {
    const client = await resolveNamed(sql, userId, "clients", action.clientName);
    const project = action.projectName ? await resolveNamed(sql, userId, "projects", action.projectName) : null;
    await insert(sql, "contracts", {
      id: nid(), user_id: userId, client_id: client.id, project_id: project?.id ?? null, type: action.contractType,
      start_date: action.startDate ?? today, end_date: action.endDate ?? null,
      value_cents: action.value != null ? reais(action.value) : 0,
      monthly_cents: action.monthly != null ? reais(action.monthly) : 0,
      conditions: "", notes: "", status: action.status ?? "rascunho", document_name: "", document_data: "",
    });
    return `Contrato criado para ${client.name}.`;
  }
  if (action.type === "create_finance") {
    const client = action.clientName ? await resolveNamed(sql, userId, "clients", action.clientName) : null;
    const project = action.projectName ? await resolveNamed(sql, userId, "projects", action.projectName) : null;
    const status = action.status ?? "pendente";
    const on = action.date ?? today;
    await insert(sql, "finances", {
      id: nid(), user_id: userId, kind: action.kind, client_id: client?.id ?? null, project_id: project?.id ?? null,
      category: action.category ?? "", description: action.description, amount_cents: reais(action.amount),
      happened_on: on, due_on: action.dueDate ?? null, paid_on: status === "pago" ? on : null,
      payment_method: action.paymentMethod ?? "", status, notes: "",
    });
    return action.kind === "entrada" ? `Entrada registrada: ${action.description}.` : `Saída registrada: ${action.description}.`;
  }
  if (action.type === "create_task") {
    const client = action.clientName ? await resolveNamed(sql, userId, "clients", action.clientName) : null;
    const project = action.projectName ? await resolveNamed(sql, userId, "projects", action.projectName) : null;
    await insert(sql, "tasks", {
      id: nid(), user_id: userId, scope: action.scope ?? "empresa", title: action.title, description: action.description ?? "",
      due_on: action.date ?? null, due_time: action.time ?? "", priority: action.priority ?? "normal",
      category: action.category ?? "", client_id: client?.id ?? null, project_id: project?.id ?? null, done: false,
    });
    const when = action.date ? `${action.date.split("-").reverse().join("/")}${action.time ? ` às ${action.time}` : ""}` : "sem data";
    return `Tarefa criada (${when}): ${action.title}.`;
  }
  const client = action.clientName ? await resolveNamed(sql, userId, "clients", action.clientName) : null;
  await insert(sql, "appointments", {
    id: nid(), user_id: userId, title: action.title, happens_on: action.date, starts_at: action.time ?? "",
    duration_min: action.durationMin ?? 60, client_id: client?.id ?? null, location: action.location ?? "",
    notes: action.notes ?? "", status: "agendado",
  });
  const [y, m, d] = action.date.split("-");
  const hour = action.time ? ` às ${action.time.replace(/^0/, "")}` : "";
  return `Compromisso criado para ${d}/${m}/${y}${hour}.`;
}

async function buildContext(sql: Sql, userId: string, today: string): Promise<string> {
  const tomorrow = addDays(today, 1);
  const bounds = monthBounds(today);
  const [counts, clients, projects, finances, tasks, appointments, contracts, updates] = await Promise.all([
    sql.query<Row>(
      `select
         (select count(*) from projects where user_id = $1 and archived_at is null and status = 'andamento') as projects_open,
         (select count(*) from tasks where user_id = $1 and done = false) as tasks_open,
         (select coalesce(sum(amount_cents),0) from finances where user_id = $1 and kind = 'entrada' and status = 'pendente') as receivable,
         (select coalesce(sum(amount_cents),0) from finances where user_id = $1 and kind = 'entrada' and status = 'pago' and coalesce(paid_on, happened_on) >= $2::date and coalesce(paid_on, happened_on) < $3::date) as received`,
      [userId, bounds.start, bounds.end],
    ),
    sql.query<Row>("select name, company, status from clients where user_id = $1 and archived_at is null order by name limit 40", [userId]),
    sql.query<Row>(
      `select p.name, p.status, c.name as client_name from projects p
       left join clients c on c.id = p.client_id where p.user_id = $1 and p.archived_at is null order by p.name limit 40`,
      [userId],
    ),
    sql.query<Row>(
      `select f.description, f.amount_cents, f.status, f.due_on, c.name as client_name from finances f
       left join clients c on c.id = f.client_id
       where f.user_id = $1 and f.kind = 'entrada' and f.status = 'pendente' order by f.due_on asc nulls last limit 15`,
      [userId],
    ),
    sql.query<Row>(
      "select title, due_on, due_time, priority, scope from tasks where user_id = $1 and done = false order by due_on asc nulls last limit 15",
      [userId],
    ),
    sql.query<Row>(
      `select a.title, a.happens_on, a.starts_at, c.name as client_name from appointments a
       left join clients c on c.id = a.client_id
       where a.user_id = $1 and a.status = 'agendado' and a.happens_on >= $2::date and a.happens_on <= $3::date
       order by a.happens_on, a.starts_at limit 15`,
      [userId, today, addDays(today, 14)],
    ),
    sql.query<Row>(
      `select ct.type, ct.end_date, c.name as client_name from contracts ct
       left join clients c on c.id = ct.client_id
       where ct.user_id = $1 and ct.archived_at is null and ct.status = 'assinado' and ct.end_date is not null and ct.end_date <= $2::date
       order by ct.end_date limit 8`,
      [userId, addDays(today, 45)],
    ),
    sql.query<Row>(
      `select p.name as project_name, u.version, u.happened_on, u.description, u.status
       from updates u join projects p on p.id = u.project_id
       where u.user_id = $1 order by u.happened_on desc limit 8`,
      [userId],
    ),
  ]);
  const money = (value: unknown) => (num(value) / 100).toFixed(2);
  return [
    `Hoje ${today}. Amanhã ${tomorrow}.`,
    `Projetos em andamento: ${num(counts[0]?.projects_open)}. Tarefas abertas: ${num(counts[0]?.tasks_open)}. A receber: R$ ${money(counts[0]?.receivable)}. Recebido no mês: R$ ${money(counts[0]?.received)}.`,
    `Clientes: ${clients.map((row) => `${str(row.name)} (${str(row.company) || "sem empresa"}, ${str(row.status)})`).join("; ") || "nenhum"}`,
    `Projetos: ${projects.map((row) => `${str(row.name)} de ${str(row.client_name) || "sem cliente"} [${str(row.status)}]`).join("; ") || "nenhum"}`,
    `Pagamentos pendentes: ${finances.map((row) => `${str(row.client_name) || "sem cliente"} — ${str(row.description)} R$ ${money(row.amount_cents)} vence ${dateOf(row.due_on) ?? "sem data"}`).join("; ") || "nenhum"}`,
    `Tarefas: ${tasks.map((row) => `${str(row.title)} ${dateOf(row.due_on) ?? "sem data"} ${str(row.due_time)} [${str(row.priority)}/${str(row.scope)}]`).join("; ") || "nenhuma"}`,
    `Agenda: ${appointments.map((row) => `${dateOf(row.happens_on)} ${str(row.starts_at)} ${str(row.title)} ${str(row.client_name)}`).join("; ") || "nenhum"}`,
    `Contratos assinados com fim até 45 dias: ${contracts.map((row) => `${str(row.client_name)} ${str(row.type)} até ${dateOf(row.end_date)}`).join("; ") || "nenhum"}`,
    `Últimas versões: ${updates.map((row) => `${str(row.project_name)} ${str(row.version)} em ${dateOf(row.happened_on)} (${str(row.status)}) ${str(row.description)}`).join("; ") || "nenhuma"}`,
  ].join("\n");
}

async function transcribe(apiKey: string, audioBase64: string, mime: string): Promise<string> {
  const bin = Buffer.from(audioBase64, "base64");
  if (bin.length < 80) throw new Error("Não consegui ouvir o áudio. Tente de novo.");
  if (bin.length > 3_500_000) throw new Error("Áudio muito longo. Fale por até um minuto.");
  const form = new FormData();
  form.append("model", "grok-voice-transcribe-2.0");
  form.append("language", "pt");
  form.append("format", "true");
  form.append("file", new File([bin], mime.includes("mp4") ? "fala.mp4" : "fala.webm", { type: mime || "audio/webm" }));
  const res = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error("Não foi possível transcrever o áudio.");
  const body = (await res.json()) as { text?: string };
  const text = body.text?.trim() ?? "";
  if (!text) throw new Error("Não entendi o áudio. Tente falar de novo.");
  return text.slice(0, 2000);
}

function mapMessage(row: Row): AssistantMessage {
  return {
    id: str(row.id),
    role: str(row.role) === "assistant" ? "assistant" : "user",
    content: str(row.content),
    createdAt: iso(row.created_at),
  };
}

async function loadMessages(sql: Sql, userId: string): Promise<AssistantMessage[]> {
  const rows = await sql.query<Row>(
    `select * from (
       select * from assistant_messages where user_id = $1 order by created_at desc limit 80
     ) recent order by created_at asc`,
    [userId],
  );
  return rows.map(mapMessage);
}

export const listAssistant = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    return { messages: await loadMessages(sql, context.userId), ai: Boolean(process.env.XAI_API_KEY) };
  });

export const clearAssistant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await sql.query("delete from assistant_messages where user_id = $1", [context.userId]);
    return { ok: true as const };
  });

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const input = read(
      z.object({
        text: z.string().trim().max(2000).optional(),
        audioBase64: z.string().max(5_000_000).optional(),
        mime: z.string().max(80).optional(),
      }),
      data,
    );
    const apiKey = process.env.XAI_API_KEY;
    const sql = await db();
    const userId = context.userId;
    let text = input.text?.trim() ?? "";
    if (input.audioBase64) {
      if (!apiKey) throw new Error("O assistente de IA não está disponível neste ambiente.");
      if (input.mime && !input.mime.startsWith("audio/")) throw new Error("Formato de áudio não suportado.");
      text = await transcribe(apiKey, input.audioBase64, input.mime || "audio/webm");
    }
    if (!text) throw new Error("Escreva ou fale um pedido.");
    rateLimit(userId);
    await insert(sql, "assistant_messages", { id: nid(), user_id: userId, role: "user", content: text });
    const today = saoPauloToday();
    let content = "O assistente de IA não está disponível neste ambiente.";
    if (apiKey) {
      try {
        const history = await loadMessages(sql, userId);
        const contextText = await buildContext(sql, userId, today);
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(28_000),
          body: JSON.stringify({
            model: "grok-4.5",
            temperature: 0.2,
            max_tokens: 900,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `Você é o assistente do Nexo. Responda em português do Brasil, curto e concreto.
Devolva somente JSON: {"reply":"texto","actions":[]}.
Não execute SQL. Não invente clientes ou valores que não foram ditos.
Datas YYYY-MM-DD. Horas HH:MM. amount em reais, número.
Status de cliente: ativo, negociacao, inativo.
Status de projeto: planejamento, andamento, entregue, manutencao, pausado.
Status de versão: planejada, andamento, entregue.
Status de contrato: rascunho, aguardando, assinado, encerrado.
Status financeiro: pendente, pago, cancelado. kind: entrada ou saida.
Prioridade: alta, normal, baixa. Escopo da tarefa: empresa ou pessoal.
Ações: create_client, update_client, create_project, update_project, create_update, create_contract, create_finance, create_task, create_appointment.
Se for só uma pergunta, actions fica vazio e reply usa o contexto.
Não diga que já gravou. O sistema confirma depois.
${contextText}`,
              },
              ...history.slice(-8).map((message) => ({ role: message.role, content: message.content })),
            ],
          }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = body.choices?.[0]?.message?.content ?? "";
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        let reply = "Pronto.";
        const lines: string[] = [];
        try {
          const json = JSON.parse(cleaned) as { reply?: unknown; actions?: unknown };
          if (typeof json.reply === "string" && json.reply.trim()) reply = json.reply.trim().slice(0, 2000);
          const actions = Array.isArray(json.actions) ? json.actions.slice(0, 4) : [];
          for (const candidate of actions) {
            const parsed = actionSchema.safeParse(candidate);
            if (!parsed.success) {
              lines.push("Ignorei uma ação incompleta.");
              continue;
            }
            try {
              lines.push(await runAction(sql, userId, parsed.data, today));
            } catch (error) {
              lines.push(error instanceof Error ? error.message : "Não consegui executar a ação.");
            }
          }
        } catch {
          reply = "Entendi o pedido, mas a resposta da IA veio fora do formato. Tente reformular.";
        }
        content = [reply, lines.length ? lines.map((line) => `• ${line}`).join("\n") : ""].filter(Boolean).join("\n\n");
      } catch {
        content = "Não consegui consultar a IA agora. Tente de novo em instantes.";
      }
    }
    await insert(sql, "assistant_messages", { id: nid(), user_id: userId, role: "assistant", content });
    return { messages: await loadMessages(sql, userId), transcript: text };
  });
