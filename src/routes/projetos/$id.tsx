import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ContractForm, FinanceForm, ProjectForm, TaskForm, UpdateForm } from "@/components/forms";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, ConfirmDialog, ErrorNote, PageSkeleton, statusTone } from "@/components/ui";
import { PROJECT_STATUS, UPDATE_STATUS, brDate, formatCents, labelOf } from "@/lib/ops/format";
import { useAuthedQuery } from "@/lib/ops/query";
import { deleteUpdate, getProject, setProjectArchived } from "@/lib/ops/server";
import type { ProjectUpdate } from "@/lib/ops/types";
import { errorText } from "@/lib/utils";

export const Route = createFileRoute("/projetos/$id")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const query = useAuthedQuery(["ops", "project", id], () => getProject({ data: { id } }));
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectUpdate | null>(null);
  const [removing, setRemoving] = useState<ProjectUpdate | null>(null);
  const [task, setTask] = useState(false);
  const [finance, setFinance] = useState(false);
  const [contract, setContract] = useState(false);
  const data = query.data;

  async function archive() {
    if (!data) return;
    try {
      await setProjectArchived({ data: { id, archived: !data.project.archivedAt } });
      toast.success(data.project.archivedAt ? "Projeto restaurado." : "Projeto arquivado.");
      await qc.invalidateQueries({ queryKey: ["ops"] });
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <Shell title="Projeto">
      {query.isLoading || data === undefined ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorNote message="Não foi possível abrir o projeto." onRetry={() => void query.refetch()} />
      ) : !data ? (
        <ErrorNote message="Projeto não encontrado." />
      ) : (
        <div className="rise grid gap-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl">{data.project.name}</h2>
                {data.project.clientId ? (
                  <Link to="/clientes/$id" params={{ id: data.project.clientId }} className="text-sm text-muted hover:underline">
                    {data.project.clientName}
                  </Link>
                ) : (
                  <p className="text-sm text-muted">Sem cliente</p>
                )}
              </div>
              <Badge tone={statusTone(data.project.status)}>{labelOf(PROJECT_STATUS, data.project.status)}</Badge>
            </div>
            {data.project.description ? <p className="mt-3 text-sm">{data.project.description}</p> : null}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Item label="Início" value={brDate(data.project.startDate)} />
              <Item label="Prazo" value={brDate(data.project.dueDate)} />
              <Item label="Valor" value={formatCents(data.project.valueCents)} />
              <Item label="Mensalidade" value={formatCents(data.project.monthlyCents)} />
              <Item label="URL" value={data.project.url} href={data.project.url || undefined} />
              <Item label="Repositório" value={data.project.repo} />
              <Item label="Banco" value={[data.project.databaseUsed, data.project.databaseName].filter(Boolean).join(" · ")} />
              <Item label="Servidor" value={data.project.server} />
            </dl>
            {data.project.techConfig ? <p className="mt-3 text-sm text-muted">{data.project.techConfig}</p> : null}
            {data.project.notes ? <p className="mt-2 text-sm text-muted">{data.project.notes}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="line" onClick={() => setEdit(true)}>Editar</Button>
              <Button variant="line" onClick={() => void archive()}>{data.project.archivedAt ? "Restaurar" : "Arquivar"}</Button>
              <Button onClick={() => { setEditing(null); setUpdateOpen(true); }}>Nova atualização</Button>
              <Button variant="line" onClick={() => setContract(true)}>Novo contrato</Button>
              <Button variant="line" onClick={() => setFinance(true)}>Novo lançamento</Button>
              <Button variant="line" onClick={() => setTask(true)}>Nova tarefa</Button>
            </div>
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-medium text-muted">Versões</h3>
            {data.updates.length === 0 ? <p className="text-sm text-muted">Nenhuma versão registrada.</p> : (
              <ol className="grid gap-3">
                {data.updates.map((item) => (
                  <li key={item.id} className="border-l border-line pl-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.version}</p>
                      <Badge tone={statusTone(item.status)}>{labelOf(UPDATE_STATUS, item.status)}</Badge>
                      <span className="text-xs text-muted">{brDate(item.happenedOn)}</span>
                    </div>
                    {item.description ? <p className="mt-1 text-sm">{item.description}</p> : null}
                    {item.bugfix ? <p className="text-sm text-muted">Correção: {item.bugfix}</p> : null}
                    {item.feature ? <p className="text-sm text-muted">Novo: {item.feature}</p> : null}
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(item); setUpdateOpen(true); }}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(item)}>Excluir</Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card>
            <h3 className="mb-2 text-sm font-medium text-muted">Contratos, valores e tarefas</h3>
            {data.contracts.map((item) => <p key={item.id} className="py-1 text-sm">{item.type} · {labelOf([{ id: item.status, label: item.status }], item.status)}</p>)}
            {data.finances.map((item) => <p key={item.id} className="py-1 text-sm">{item.description} · {formatCents(item.amountCents)}</p>)}
            {data.tasks.map((item) => <p key={item.id} className="py-1 text-sm">{item.done ? "Feita · " : ""}{item.title}</p>)}
            {!data.contracts.length && !data.finances.length && !data.tasks.length ? <p className="text-sm text-muted">Nada vinculado ainda.</p> : null}
          </Card>
          <ProjectForm open={edit} onOpenChange={setEdit} initial={data.project} />
          <UpdateForm open={updateOpen} onOpenChange={setUpdateOpen} initial={editing} projectId={id} />
          <TaskForm open={task} onOpenChange={setTask} projectId={id} clientId={data.project.clientId} />
          <FinanceForm open={finance} onOpenChange={setFinance} projectId={id} clientId={data.project.clientId} />
          <ContractForm open={contract} onOpenChange={setContract} projectId={id} clientId={data.project.clientId} />
          <ConfirmDialog
            open={!!removing}
            onOpenChange={(open) => { if (!open) setRemoving(null); }}
            title="Excluir versão"
            body="Essa versão sai do histórico do projeto."
            confirmLabel="Excluir"
            danger
            onConfirm={() => {
              if (!removing) return;
              void deleteUpdate({ data: { id: removing.id } })
                .then(async () => {
                  toast.success("Versão excluída.");
                  setRemoving(null);
                  await qc.invalidateQueries({ queryKey: ["ops"] });
                })
                .catch((error) => toast.error(errorText(error)));
            }}
          />
        </div>
      )}
    </Shell>
  );
}

function Item({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="break-all">
        {href ? <a href={href} className="hover:underline" target="_blank" rel="noreferrer">{value}</a> : value || "—"}
      </dd>
    </div>
  );
}
