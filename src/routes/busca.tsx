import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { Card, ErrorNote, TextInput } from "@/components/ui";
import { useAuthedQuery } from "@/lib/ops/query";
import { globalSearch } from "@/lib/ops/server";
import type { SearchHit } from "@/lib/ops/types";

export const Route = createFileRoute("/busca")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: SearchPage,
});

const KIND = {
  cliente: "Clientes",
  projeto: "Projetos",
  contrato: "Contratos",
  atualizacao: "Atualizações",
  tarefa: "Tarefas",
  agenda: "Agenda",
};

function SearchPage() {
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q);
  const [debounced, setDebounced] = useState(search.q);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(q), 250);
    return () => window.clearTimeout(timer);
  }, [q]);
  const query = useAuthedQuery(["ops", "search", debounced], () => globalSearch({ data: { q: debounced } }));
  const groups = new Map<string, NonNullable<typeof query.data>["hits"]>();
  for (const hit of query.data?.hits ?? []) {
    const list = groups.get(hit.kind) ?? [];
    list.push(hit);
    groups.set(hit.kind, list);
  }

  return (
    <Shell title="Busca">
      <TextInput value={q} onChange={(event) => setQ(event.target.value)} placeholder="Nome, projeto, tarefa, contrato" autoFocus />
      <div className="mt-4 grid gap-4">
        {debounced.trim().length < 2 ? (
          <p className="text-sm text-muted">Digite pelo menos duas letras.</p>
        ) : query.isError ? (
          <ErrorNote message="Não foi possível buscar." onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <p className="text-sm text-muted">Buscando…</p>
        ) : groups.size === 0 ? (
          <Card><p className="text-sm text-muted">Nada encontrado para “{debounced}”.</p></Card>
        ) : (
          [...groups.entries()].map(([kind, hits]) => (
            <section key={kind}>
              <h2 className="mb-2 text-sm font-medium text-muted">{KIND[kind as keyof typeof KIND]}</h2>
              <div className="grid gap-2">
                {hits.map((hit) => (
                  <Hit key={`${hit.kind}-${hit.id}`} hit={hit} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </Shell>
  );
}

function Hit({ hit }: { hit: SearchHit }) {
  const body = (
    <Card className="hover:border-ink/20">
      <p className="font-medium">{hit.title}</p>
      {hit.subtitle ? <p className="text-sm text-muted">{hit.subtitle}</p> : null}
    </Card>
  );
  if (hit.kind === "cliente") return <Link to="/clientes/$id" params={{ id: hit.id }}>{body}</Link>;
  if (hit.kind === "projeto" || hit.kind === "atualizacao") {
    const projectId = hit.kind === "projeto" ? hit.id : hit.href.split("/").pop() ?? "";
    return <Link to="/projetos/$id" params={{ id: projectId }}>{body}</Link>;
  }
  if (hit.kind === "contrato") return <Link to="/contratos" search={{ id: hit.id }}>{body}</Link>;
  if (hit.kind === "tarefa") return <Link to="/tarefas">{body}</Link>;
  return <Link to="/agenda">{body}</Link>;
}
