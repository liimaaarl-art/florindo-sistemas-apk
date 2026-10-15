import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppointmentForm, ClientForm, ContractForm, FinanceForm, ProjectForm, TaskForm } from "@/components/forms";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, ErrorNote, PageSkeleton, statusTone } from "@/components/ui";
import { CLIENT_STATUS, PROJECT_STATUS, brDate, formatCents, labelOf, whenLabel } from "@/lib/ops/format";
import { useAuthedQuery } from "@/lib/ops/query";
import { getClient, setClientArchived } from "@/lib/ops/server";
import { errorText } from "@/lib/utils";

export const Route = createFileRoute("/clientes/$id")({
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { id } = Route.useParams();
  const query = useAuthedQuery(["ops", "client", id], () => getClient({ data: { id } }));
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [project, setProject] = useState(false);
  const [task, setTask] = useState(false);
  const [appointment, setAppointment] = useState(false);
  const [finance, setFinance] = useState(false);
  const [contract, setContract] = useState(false);
  const data = query.data;

  async function archive() {
    if (!data) return;
    try {
      await setClientArchived({ data: { id, archived: !data.client.archivedAt } });
      toast.success(data.client.archivedAt ? "Cliente restaurado." : "Cliente arquivado.");
      await qc.invalidateQueries({ queryKey: ["ops"] });
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <Shell title="Cliente">
      {query.isLoading || data === undefined ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorNote message="Não foi possível abrir o cliente." onRetry={() => void query.refetch()} />
      ) : !data ? (
        <ErrorNote message="Cliente não encontrado." />
      ) : (
        <div className="rise grid gap-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl">{data.client.name}</h2>
                <p className="text-sm text-muted">{data.client.company || "Sem empresa"}</p>
              </div>
              <Badge tone={statusTone(data.client.status)}>{labelOf(CLIENT_STATUS, data.client.status)}</Badge>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Telefone" value={data.client.phone} />
              <Info label="WhatsApp" value={data.client.whatsapp} href={data.client.whatsapp ? `https://wa.me/${data.client.whatsapp.replace(/\D/g, "")}` : undefined} />
              <Info label="E-mail" value={data.client.email} />
              <Info label="Segmento" value={data.client.segment} />
              <Info label="CPF/CNPJ" value={data.client.document} />
              <Info label="Cadastro" value={brDate(data.client.createdAt)} />
              <Info label="Endereço" value={data.client.address} />
            </dl>
            {data.client.extra ? <p className="mt-3 text-sm">{data.client.extra}</p> : null}
            {data.client.notes ? <p className="mt-2 text-sm text-muted">{data.client.notes}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="line" onClick={() => setEdit(true)}>Editar</Button>
              <Button variant="line" onClick={() => void archive()}>{data.client.archivedAt ? "Restaurar" : "Arquivar"}</Button>
              <Button variant="line" onClick={() => setProject(true)}>Novo projeto</Button>
              <Button variant="line" onClick={() => setTask(true)}>Nova tarefa</Button>
              <Button variant="line" onClick={() => setAppointment(true)}>Novo compromisso</Button>
              <Button variant="line" onClick={() => setFinance(true)}>Nova entrada</Button>
              <Button variant="line" onClick={() => setContract(true)}>Novo contrato</Button>
            </div>
          </Card>
          <Section title="Projetos">
            {data.projects.length === 0 ? <Muted>Nenhum sistema vinculado.</Muted> : data.projects.map((item) => (
              <Link key={item.id} to="/projetos/$id" params={{ id: item.id }} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm font-medium">{item.name}</span>
                <Badge tone={statusTone(item.status)}>{labelOf(PROJECT_STATUS, item.status)}</Badge>
              </Link>
            ))}
          </Section>
          <Section title="Contratos">
            {data.contracts.length === 0 ? <Muted>Sem contratos.</Muted> : data.contracts.map((item) => (
              <p key={item.id} className="flex justify-between gap-3 py-2 text-sm">
                <span>{item.type}</span>
                <span className="text-muted">{brDate(item.endDate)}</span>
              </p>
            ))}
          </Section>
          <Section title="Financeiro">
            {data.finances.length === 0 ? <Muted>Sem lançamentos.</Muted> : data.finances.map((item) => (
              <p key={item.id} className="flex justify-between gap-3 py-2 text-sm">
                <span>{item.description}</span>
                <span className="tabular-nums">{formatCents(item.kind === "saida" ? -item.amountCents : item.amountCents)}</span>
              </p>
            ))}
          </Section>
          <Section title="Tarefas">
            {data.tasks.length === 0 ? <Muted>Sem tarefas.</Muted> : data.tasks.map((item) => (
              <p key={item.id} className="py-2 text-sm">{item.done ? "Concluída · " : ""}{item.title}</p>
            ))}
          </Section>
          <Section title="Agenda">
            {data.appointments.length === 0 ? <Muted>Sem compromissos.</Muted> : data.appointments.map((item) => (
              <p key={item.id} className="py-2 text-sm">{brDate(item.happensOn)}{item.startsAt ? ` às ${item.startsAt}` : ""} · {item.title}</p>
            ))}
          </Section>
          <Section title="Histórico">
            {data.activities.length === 0 ? <Muted>Sem histórico.</Muted> : data.activities.map((item) => (
              <p key={item.id} className="py-2 text-sm">{item.summary}</p>
            ))}
          </Section>
          <ClientForm open={edit} onOpenChange={setEdit} initial={data.client} />
          <ProjectForm open={project} onOpenChange={setProject} clientId={id} />
          <TaskForm open={task} onOpenChange={setTask} clientId={id} />
          <AppointmentForm open={appointment} onOpenChange={setAppointment} clientId={id} />
          <FinanceForm open={finance} onOpenChange={setFinance} clientId={id} kind="entrada" />
          <ContractForm open={contract} onOpenChange={setContract} clientId={id} />
        </div>
      )}
    </Shell>
  );
}

function Info({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd>
        {href && value ? (
          <a href={href} className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer">{value}</a>
        ) : (
          value || "—"
        )}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h3 className="mb-1 text-sm font-medium text-muted">{title}</h3>
      {children}
    </Card>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-muted">{children}</p>;
}
