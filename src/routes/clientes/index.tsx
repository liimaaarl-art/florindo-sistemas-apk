import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ClientForm } from "@/components/forms";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, EmptyState, ErrorNote, PageSkeleton, TextInput, statusTone } from "@/components/ui";
import { CLIENT_STATUS, labelOf } from "@/lib/ops/format";
import { useAuthedQuery } from "@/lib/ops/query";
import { listClients } from "@/lib/ops/server";
import type { ClientStatus } from "@/lib/ops/types";

export const Route = createFileRoute("/clientes/")({
  component: ClientsPage,
});

function ClientsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ClientStatus>("");
  const [archived, setArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const query = useAuthedQuery(["ops", "clients", q, status, archived], () =>
    listClients({ data: { q, status: status || undefined, archived } }),
  );

  return (
    <Shell title="Clientes">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <TextInput value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar nome, empresa ou e-mail" />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "" | ClientStatus)}
          className="h-11 rounded-lg border border-line bg-card px-3 text-sm"
        >
          <option value="">Todos os status</option>
          {CLIENT_STATUS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <Button variant="line" onClick={() => setArchived((value) => !value)}>
          {archived ? "Ver ativos" : "Arquivados"}
        </Button>
        <Button onClick={() => setOpen(true)}>Novo cliente</Button>
      </div>
      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorNote message="Não foi possível carregar os clientes." onRetry={() => void query.refetch()} />
      ) : query.data?.length ? (
        <div className="grid gap-3">
          {query.data.map((client) => (
            <Link key={client.id} to="/clientes/$id" params={{ id: client.id }}>
              <Card className="grid gap-1 transition-[border-color] duration-150 hover:border-ink/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{client.name}</p>
                    <p className="truncate text-sm text-muted">{client.company || "Sem empresa"}</p>
                  </div>
                  <Badge tone={statusTone(client.status)}>{labelOf(CLIENT_STATUS, client.status)}</Badge>
                </div>
                <p className="truncate text-xs text-muted">
                  {[client.segment, client.phone || client.whatsapp, client.email].filter(Boolean).join(" · ") || "Sem contato"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhum cliente aqui" body="A busca não encontrou ninguém com esses filtros." action={<Button onClick={() => setOpen(true)}>Novo cliente</Button>} />
      )}
      <ClientForm open={open} onOpenChange={setOpen} />
    </Shell>
  );
}
