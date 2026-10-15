export type ClientStatus = "ativo" | "negociacao" | "inativo";
export type ProjectStatus = "planejamento" | "andamento" | "entregue" | "manutencao" | "pausado";
export type UpdateStatus = "planejada" | "andamento" | "entregue";
export type ContractStatus = "rascunho" | "aguardando" | "assinado" | "encerrado";
export type FinanceKind = "entrada" | "saida";
export type FinanceStatus = "pendente" | "pago" | "cancelado";
export type TaskScope = "empresa" | "pessoal";
export type Priority = "alta" | "normal" | "baixa";
export type AppointmentStatus = "agendado" | "concluido" | "cancelado";

export type Client = {
  id: string;
  name: string;
  company: string;
  phone: string;
  whatsapp: string;
  email: string;
  segment: string;
  document: string;
  address: string;
  status: ClientStatus;
  notes: string;
  extra: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  clientId: string | null;
  clientName: string;
  name: string;
  description: string;
  startDate: string | null;
  dueDate: string | null;
  status: ProjectStatus;
  url: string;
  repo: string;
  databaseUsed: string;
  databaseName: string;
  server: string;
  techConfig: string;
  notes: string;
  valueCents: number;
  monthlyCents: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectUpdate = {
  id: string;
  projectId: string;
  projectName: string;
  version: string;
  happenedOn: string;
  description: string;
  bugfix: string;
  feature: string;
  status: UpdateStatus;
  notes: string;
  createdAt: string;
};

export type Contract = {
  id: string;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  projectName: string;
  type: string;
  startDate: string | null;
  endDate: string | null;
  valueCents: number;
  monthlyCents: number;
  conditions: string;
  notes: string;
  status: ContractStatus;
  documentName: string;
  hasDocument: boolean;
  documentData?: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Finance = {
  id: string;
  kind: FinanceKind;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  projectName: string;
  category: string;
  description: string;
  amountCents: number;
  happenedOn: string;
  dueOn: string | null;
  paidOn: string | null;
  paymentMethod: string;
  status: FinanceStatus;
  notes: string;
  createdAt: string;
};

export type Task = {
  id: string;
  scope: TaskScope;
  title: string;
  description: string;
  dueOn: string | null;
  dueTime: string;
  priority: Priority;
  category: string;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  projectName: string;
  done: boolean;
  createdAt: string;
};

export type Appointment = {
  id: string;
  title: string;
  happensOn: string;
  startsAt: string;
  durationMin: number;
  clientId: string | null;
  clientName: string;
  location: string;
  notes: string;
  status: AppointmentStatus;
  createdAt: string;
};

export type Activity = {
  id: string;
  clientId: string | null;
  projectId: string | null;
  kind: string;
  summary: string;
  createdAt: string;
};

export type Directory = {
  today: string;
  clients: { id: string; name: string; company: string; status: ClientStatus }[];
  projects: { id: string; name: string; clientId: string | null; status: ProjectStatus }[];
};

export type MonthPoint = { month: string; label: string; entrada: number; saida: number };

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type SearchHit = {
  kind: "cliente" | "projeto" | "contrato" | "atualizacao" | "tarefa" | "agenda";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};
