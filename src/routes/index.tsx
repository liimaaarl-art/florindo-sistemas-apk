import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChartSlot } from "@/components/chart-slot";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, EmptyState, ErrorNote, PageSkeleton, statusTone } from "@/components/ui";
import { PROJECT_STATUS, brDate, formatCents, labelOf, longDate, whenLabel } from "@/lib/ops/format";
import { useAuthedQuery } from "@/lib/ops/query";
import { getDashboard, seedDemo } from "@/lib/ops/server";
import { errorText } from "@/lib/utils";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const query = useAuthedQuery(["ops", "dashboard"], () => getDashboard());
  const qc = useQueryClient();
  const [seeding, setSeeding] = useState(false);

  async function loadDemo() {
    setSeeding(true);
    try {
      await seedDemo();
      toast.success("Exemplo carregado. Os dados já estão na sua conta.");
      await qc.invalidateQueries({ queryKey: ["ops"] });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSeeding(false);
    }
  }

  const data = query.data;
  return (
    <Shell title="Início">
      {query.isLoading || !data ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorNote message="Não foi possível conectar ao servidor." onRetry={() => void query.refetch()} />
      ) : (
        <div className="rise grid gap-4">
          <p className="text-sm text-muted capitalize">{longDate(data.today)}</p>
          {data.empty ? (
            <EmptyState
              title="Sua operação ainda está em branco"
              body="Cadastre o primeiro cliente ou carregue um exemplo ligado: barbearia, proposta, contrato e agenda de amanhã."
              action={
                <Button onClick={() => void loadDemo()} disabled={seeding}>
                  {seeding ? "Carregando…" : "Carregar exemplo"}
                </Button>
              }
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi label="Clientes ativos" value={String(data.counts.clientsActive)} />
            <Kpi label="Em negociação" value={String(data.counts.clientsNegotiation)} />
            <Kpi label="Projetos ativos" value={String(data.counts.projectsActive)} />
            <Kpi label="Em manutenção" value={String(data.counts.projectsMaintenance)} />
            <Kpi label="Tarefas pendentes" value={String(data.counts.tasksPending)} />
            <Kpi label="Contratos ativos" value={String(data.counts.contractsActive)} />
            <Kpi label="A receber" value={formatCents(data.counts.receivableCents)} />
            <Kpi label="Recebido no mês" value={formatCents(data.counts.receivedMonthCents)} />
            <Kpi label="Resultado do mês" value={formatCents(data.counts.profitMonthCents)} />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-medium text-muted">Tarefas mais urgentes</h2>
              {data.urgentTasks.length === 0 ? (
                <p className="text-sm text-muted">Nada pendente.</p>
              ) : (
                <ul className="grid gap-2">
                  {data.urgentTasks.map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted">
                          {whenLabel(task.dueOn, data.today)}
                          {task.dueTime ? ` · ${task.dueTime}` : ""}
                          {task.clientName ? ` · ${task.clientName}` : ""}
                        </p>
                      </div>
                      <Badge tone={task.priority === "alta" ? "warn" : "neutral"}>
                        {task.priority === "alta" ? "Alta" : task.priority === "baixa" ? "Baixa" : "Normal"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-medium text-muted">Próximos compromissos</h2>
              {data.upcoming.length === 0 ? (
                <p className="text-sm text-muted">Agenda livre.</p>
              ) : (
                <ul className="grid gap-2">
                  {data.upcoming.map((item) => (
                    <li key={item.id}>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted">
                        {whenLabel(item.happensOn, data.today)}
                        {item.startsAt ? ` às ${item.startsAt}` : ""}
                        {item.clientName ? ` · ${item.clientName}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-medium text-muted">Clientes que precisam de atenção</h2>
              {data.attention.length === 0 ? (
                <p className="text-sm text-muted">Ninguém em negociação.</p>
              ) : (
                <ul className="grid gap-2">
                  {data.attention.map((client) => (
                    <li key={client.id}>
                      <Link to="/clientes/$id" params={{ id: client.id }} className="text-sm font-medium hover:underline">
                        {client.name}
                      </Link>
                      <p className="text-xs text-muted">{client.company || "Sem empresa"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-medium text-muted">Projetos sem atualização recente</h2>
              {data.staleProjects.length === 0 ? (
                <p className="text-sm text-muted">Os projetos ativos têm histórico recente.</p>
              ) : (
                <ul className="grid gap-2">
                  {data.staleProjects.map((project) => (
                    <li key={project.id} className="flex items-center justify-between gap-3">
                      <Link to="/projetos/$id" params={{ id: project.id }} className="text-sm font-medium hover:underline">
                        {project.name}
                      </Link>
                      <Badge tone={statusTone(project.status)}>{labelOf(PROJECT_STATUS, project.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <Card>
            <h2 className="mb-1 text-sm font-medium text-muted">Resumo financeiro</h2>
            <p className="mb-3 text-xs text-muted">Entradas e saídas pagas nos últimos seis meses.</p>
            <ChartSlot data={data.series} />
          </Card>
          {data.expiring.length ? (
            <Card>
              <h2 className="mb-3 text-sm font-medium text-muted">Contratos perto do vencimento</h2>
              <ul className="grid gap-2">
                {data.expiring.map((contract) => (
                  <li key={contract.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {contract.clientName || "Sem cliente"} · {contract.type}
                    </span>
                    <span className="text-warn">{brDate(contract.endDate)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          <Card>
            <h2 className="mb-3 text-sm font-medium text-muted">Atividades recentes</h2>
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted">Ainda não há movimento.</p>
            ) : (
              <ul className="grid gap-2">
                {data.recent.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm">{item.summary}</span>
                    <span className="shrink-0 text-xs text-muted">{brDate(item.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </Shell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="grid gap-1">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl leading-tight tabular-nums text-ink">{value}</p>
    </Card>
  );
}
