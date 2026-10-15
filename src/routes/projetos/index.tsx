import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ProjectForm } from "@/components/forms";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, EmptyState, ErrorNote, PageSkeleton, TextInput, statusTone } from "@/components/ui";
import { PROJECT_STATUS, brDate, formatCents, labelOf } from "@/lib/ops/format";
import { useAuthedQuery } from "@/lib/ops/query";
import { listProjects } from "@/lib/ops/server";
import type { ProjectStatus } from "@/lib/ops/types";

export const Route = createFileRoute("/projetos/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ProjectStatus>("");
  const [archived, setArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const query = useAuthedQuery(["ops", "projects", q, status, archived], () =>
    listProjects({ data: { q, status: status || undefined, archived } }),
  );

  return (
    <Shell title="Projetos">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <TextInput value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar projeto ou cliente" />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "" | ProjectStatus)}
          className="h-11 rounded-lg border border-line bg-card px-3 text-sm"
        >
          <option value="">Todos os status</option>
          {PROJECT_STATUS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <Button variant="line" onClick={() => setArchived((value) => !value)}>{archived ? "Ver ativos" : "Arquivados"}</Button>
        <Button onClick={() => setOpen(true)}>Novo projeto</Button>
      </div>
      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorNote message="Não foi possível carregar os projetos." onRetry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <div className="grid gap-3">
          {query.data.map((project) => (
            <Link key={project.id} to="/projetos/$id" params={{ id: project.id }}>
              <Card className="grid gap-1 hover:border-ink/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{project.name}</p>
                    <p className="truncate text-sm text-muted">{project.clientName || "Sem cliente"}</p>
                  </div>
                  <Badge tone={statusTone(project.status)}>{labelOf(PROJECT_STATUS, project.status)}</Badge>
                </div>
                <p className="text-xs text-muted">
                  {project.monthlyCents ? `Mensalidade ${formatCents(project.monthlyCents)}` : formatCents(project.valueCents)}
                  {project.dueDate ? ` · prazo ${brDate(project.dueDate)}` : ""}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhum projeto" body="Quando um sistema entrar em planejamento, ele aparece aqui." action={<Button onClick={() => setOpen(true)}>Novo projeto</Button>} />
      )}
      <ProjectForm open={open} onOpenChange={setOpen} />
    </Shell>
  );
}
