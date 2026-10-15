import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ContractForm } from "@/components/forms";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, EmptyState, ErrorNote, PageSkeleton, statusTone } from "@/components/ui";
import { CONTRACT_STATUS, brDate, formatCents, labelOf } from "@/lib/ops/format";
import { useAuthedQuery } from "@/lib/ops/query";
import { getContract, listContracts, setContractArchived } from "@/lib/ops/server";
import type { Contract } from "@/lib/ops/types";
import { errorText } from "@/lib/utils";

export const Route = createFileRoute("/contratos")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : "",
  }),
  component: ContractsPage,
});

function ContractsPage() {
  const { id } = Route.useSearch();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [archived, setArchived] = useState(false);
  const query = useAuthedQuery(["ops", "contracts", archived], () => listContracts({ data: { archived } }));
  const qc = useQueryClient();
  const data = query.data;
  const visible = data?.contracts ?? [];
  const focus = visible.find((item) => item.id === id);

  async function download(contract: Contract) {
    try {
      const full = await getContract({ data: { id: contract.id } });
      if (!full?.documentData) {
        toast.error("Esse contrato não tem arquivo.");
        return;
      }
      const link = document.createElement("a");
      link.href = full.documentData;
      link.download = full.documentName || "contrato";
      link.click();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <Shell title="Contratos">
      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={() => { setEditing(null); setOpen(true); }}>Novo contrato</Button>
        <Button variant="line" onClick={() => setArchived((value) => !value)}>{archived ? "Ver ativos" : "Arquivados"}</Button>
      </div>
      {query.isLoading || !data ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorNote message="Não foi possível carregar os contratos." onRetry={() => void query.refetch()} />
      ) : (
        <div className="rise grid gap-3">
          {visible.some((item) => item.status === "assinado" && item.endDate && item.endDate >= data.today && item.endDate <= data.soon) ? (
            <Card className="border-warn/30">
              <p className="text-sm text-warn">Há contratos assinados que vencem nos próximos 30 dias.</p>
            </Card>
          ) : null}
          {focus ? <p className="text-sm text-muted">Mostrando também o contrato encontrado na busca: {focus.type}.</p> : null}
          {visible.length === 0 ? (
            <EmptyState title="Nenhum contrato" body="Rascunhos, assinaturas e vencimentos ficam nesta lista." action={<Button onClick={() => setOpen(true)}>Novo contrato</Button>} />
          ) : visible.map((item) => {
            const expiring = item.status === "assinado" && !!item.endDate && item.endDate >= data.today && item.endDate <= data.soon;
            return (
              <Card key={item.id} className={item.id === id ? "border-ink/30" : undefined}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.type}</p>
                    <p className="text-sm text-muted">{item.clientName || "Sem cliente"}{item.projectName ? ` · ${item.projectName}` : ""}</p>
                  </div>
                  <Badge tone={expiring ? "warn" : statusTone(item.status)}>{labelOf(CONTRACT_STATUS, item.status)}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {brDate(item.startDate)} — {brDate(item.endDate)} · {formatCents(item.valueCents)}
                  {item.monthlyCents ? ` · mensal ${formatCents(item.monthlyCents)}` : ""}
                </p>
                {item.conditions ? <p className="mt-2 text-sm">{item.conditions}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="line" onClick={() => { setEditing(item); setOpen(true); }}>Editar</Button>
                  {item.hasDocument ? <Button size="sm" variant="line" onClick={() => void download(item)}>Baixar arquivo</Button> : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void setContractArchived({ data: { id: item.id, archived: !item.archivedAt } })
                        .then(async () => {
                          toast.success(item.archivedAt ? "Contrato restaurado." : "Contrato arquivado.");
                          await qc.invalidateQueries({ queryKey: ["ops"] });
                        })
                        .catch((error) => toast.error(errorText(error)));
                    }}
                  >
                    {item.archivedAt ? "Restaurar" : "Arquivar"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <ContractForm open={open} onOpenChange={setOpen} initial={editing} />
    </Shell>
  );
}
