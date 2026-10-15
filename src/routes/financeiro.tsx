import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChartSlot } from "@/components/chart-slot";
import { FinanceForm } from "@/components/forms";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, ConfirmDialog, ErrorNote, PageSkeleton, statusTone } from "@/components/ui";
import { FINANCE_STATUS, addDays, brDate, formatCents, labelOf, monthBounds, saoPauloToday } from "@/lib/ops/format";
import { useAuthedQuery } from "@/lib/ops/query";
import { deleteFinance, listFinance, setFinanceStatus } from "@/lib/ops/server";
import type { Finance } from "@/lib/ops/types";
import { errorText } from "@/lib/utils";

export const Route = createFileRoute("/financeiro")({
  component: FinancePage,
});

function FinancePage() {
  const today = saoPauloToday();
  const bounds = monthBounds(today);
  const [from, setFrom] = useState(bounds.start);
  const [to, setTo] = useState(addDays(bounds.end, -1));
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Finance["kind"]>("entrada");
  const [editing, setEditing] = useState<Finance | null>(null);
  const [removing, setRemoving] = useState<Finance | null>(null);
  const query = useAuthedQuery(["ops", "finance", from, to], () => listFinance({ data: { from, to } }));
  const qc = useQueryClient();
  const data = query.data;
  const maxBar = useMemo(() => Math.max(1, ...(data?.byClient.map((item) => item.cents) ?? [1])), [data]);

  function preset(next: "month" | "prev" | "year" | "all") {
    if (next === "month") {
      setFrom(bounds.start);
      setTo(addDays(bounds.end, -1));
    } else if (next === "prev") {
      const prevEnd = addDays(bounds.start, -1);
      const prevBounds = monthBounds(prevEnd);
      setFrom(prevBounds.start);
      setTo(prevEnd);
    } else if (next === "year") {
      setFrom(bounds.yearStart);
      setTo(addDays(bounds.end, -1));
    } else {
      setFrom("2020-01-01");
      setTo("2035-12-31");
    }
  }

  return (
    <Shell title="Financeiro">
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="line" size="sm" onClick={() => preset("month")}>Este mês</Button>
        <Button variant="line" size="sm" onClick={() => preset("prev")}>Mês passado</Button>
        <Button variant="line" size="sm" onClick={() => preset("year")}>Ano</Button>
        <Button variant="line" size="sm" onClick={() => preset("all")}>Tudo</Button>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 rounded-lg border border-line bg-card px-2 text-sm" />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 rounded-lg border border-line bg-card px-2 text-sm" />
        <Button size="sm" onClick={() => { setEditing(null); setKind("entrada"); setOpen(true); }}>Nova entrada</Button>
        <Button size="sm" variant="line" onClick={() => { setEditing(null); setKind("saida"); setOpen(true); }}>Nova saída</Button>
      </div>
      {query.isLoading || !data ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorNote message="Não foi possível carregar o financeiro." onRetry={() => void query.refetch()} />
      ) : (
        <div className="rise grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Recebido no período" value={formatCents(data.receivedCents)} />
            <Stat label="Pendente" value={formatCents(data.pendingCents)} />
            <Stat label="Despesas" value={formatCents(data.expenseCents)} />
            <Stat label="Lucro" value={formatCents(data.profitCents)} />
          </div>
          <Card>
            <p className="mb-1 text-sm text-muted">Receita do ano {formatCents(data.yearCents)}</p>
            <ChartSlot data={data.series} />
          </Card>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-medium text-muted">Por cliente</h2>
              {data.byClient.length === 0 ? <p className="text-sm text-muted">Sem entradas no período.</p> : data.byClient.map((item) => (
                <div key={item.id} className="mb-2">
                  <div className="mb-1 flex justify-between text-sm"><span>{item.name}</span><span className="tabular-nums">{formatCents(item.cents)}</span></div>
                  <div className="h-1.5 rounded-full bg-ink/5"><div className="h-1.5 rounded-full bg-ink" style={{ width: `${Math.max(6, (item.cents / maxBar) * 100)}%` }} /></div>
                </div>
              ))}
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-medium text-muted">Por projeto</h2>
              {data.byProject.length === 0 ? <p className="text-sm text-muted">Sem entradas ligadas a projetos.</p> : data.byProject.map((item) => (
                <p key={item.id} className="flex justify-between py-1 text-sm"><span>{item.name}</span><span className="tabular-nums">{formatCents(item.cents)}</span></p>
              ))}
            </Card>
          </div>
          <div className="grid gap-3">
            {data.rows.length === 0 ? <Card><p className="text-sm text-muted">Nenhum lançamento nesse período.</p></Card> : data.rows.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.description}</p>
                    <p className="text-sm text-muted">
                      {item.kind === "entrada" ? "Entrada" : "Saída"} · {brDate(item.happenedOn)}
                      {item.clientName ? ` · ${item.clientName}` : ""}
                      {item.projectName ? ` · ${item.projectName}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl tabular-nums">{formatCents(item.amountCents)}</p>
                    <Badge tone={statusTone(item.status)}>{labelOf(FINANCE_STATUS, item.status)}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status !== "pago" && item.status !== "cancelado" ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        void setFinanceStatus({ data: { id: item.id, status: "pago" } })
                          .then(async (result) => {
                            toast.success(result.kind === "entrada" ? "Pagamento marcado como recebido." : "Despesa marcada como paga.");
                            await qc.invalidateQueries({ queryKey: ["ops"] });
                          })
                          .catch((error) => toast.error(errorText(error)));
                      }}
                    >
                      Marcar como pago
                    </Button>
                  ) : null}
                  <Button size="sm" variant="line" onClick={() => { setEditing(item); setKind(item.kind); setOpen(true); }}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(item)}>Excluir</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      <FinanceForm open={open} onOpenChange={setOpen} initial={editing} kind={kind} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(value) => { if (!value) setRemoving(null); }}
        title="Excluir lançamento"
        body="O valor sai do histórico financeiro."
        confirmLabel="Excluir"
        danger
        onConfirm={() => {
          if (!removing) return;
          void deleteFinance({ data: { id: removing.id } })
            .then(async () => {
              toast.success("Lançamento excluído.");
              setRemoving(null);
              await qc.invalidateQueries({ queryKey: ["ops"] });
            })
            .catch((error) => toast.error(errorText(error)));
        }}
      />
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl tabular-nums">{value}</p>
    </Card>
  );
}
