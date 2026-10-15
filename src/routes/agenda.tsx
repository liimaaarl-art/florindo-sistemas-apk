import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppointmentForm } from "@/components/forms";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, ErrorNote, PageSkeleton, statusTone } from "@/components/ui";
import { addDays, brDate, whenLabel } from "@/lib/ops/format";
import { useAuthedQuery } from "@/lib/ops/query";
import { deleteAppointment, listAppointments, saveAppointment } from "@/lib/ops/server";
import type { Appointment } from "@/lib/ops/types";
import { errorText } from "@/lib/utils";

export const Route = createFileRoute("/agenda")({
  component: AgendaPage,
});

function AgendaPage() {
  const query = useAuthedQuery(["ops", "agenda"], () => listAppointments({ data: {} }));
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const data = query.data;
  const days = useMemo(() => (data ? Array.from({ length: 7 }, (_, index) => addDays(data.today, index)) : []), [data]);
  const filtered = data?.appointments.filter((item) => (day ? item.happensOn === day : true)) ?? [];
  const groups = new Map<string, Appointment[]>();
  for (const item of filtered) {
    const list = groups.get(item.happensOn) ?? [];
    list.push(item);
    groups.set(item.happensOn, list);
  }

  return (
    <Shell title="Agenda">
      {query.isLoading || !data ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorNote message="Não foi possível carregar a agenda." onRetry={() => void query.refetch()} />
      ) : (
        <div className="rise grid gap-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button size="sm" variant={day === null ? "primary" : "line"} onClick={() => setDay(null)}>Tudo</Button>
            {days.map((date) => (
              <Button key={date} size="sm" variant={day === date ? "primary" : "line"} onClick={() => setDay(date)}>
                {whenLabel(date, data.today)}
              </Button>
            ))}
            <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>Novo compromisso</Button>
          </div>
          {[...groups.entries()].length === 0 ? (
            <Card><p className="text-sm text-muted">Nenhum compromisso nesse recorte.</p></Card>
          ) : [...groups.entries()].map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-2 text-sm font-medium text-muted">{whenLabel(date, data.today)} · {brDate(date)}</h2>
              <div className="grid gap-2">
                {items.map((item) => (
                  <Card key={item.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.startsAt || "Dia todo"} · {item.title}</p>
                        <p className="text-sm text-muted">
                          {item.durationMin} min{item.clientName ? ` · ${item.clientName}` : ""}{item.location ? ` · ${item.location}` : ""}
                        </p>
                        {item.notes ? <p className="mt-1 text-sm">{item.notes}</p> : null}
                      </div>
                      <Badge tone={statusTone(item.status)}>{item.status === "agendado" ? "Agendado" : item.status === "concluido" ? "Concluído" : "Cancelado"}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.status === "agendado" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            void saveAppointment({
                              data: {
                                id: item.id,
                                title: item.title,
                                happensOn: item.happensOn,
                                startsAt: item.startsAt,
                                durationMin: item.durationMin,
                                clientId: item.clientId,
                                location: item.location,
                                notes: item.notes,
                                status: "concluido",
                              },
                            })
                              .then(async () => {
                                toast.success("Compromisso concluído.");
                                await qc.invalidateQueries({ queryKey: ["ops"] });
                              })
                              .catch((error) => toast.error(errorText(error)));
                          }}
                        >
                          Concluir
                        </Button>
                      ) : null}
                      <Button size="sm" variant="line" onClick={() => { setEditing(item); setOpen(true); }}>Editar</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void deleteAppointment({ data: { id: item.id } })
                            .then(async () => {
                              toast.success("Compromisso excluído.");
                              await qc.invalidateQueries({ queryKey: ["ops"] });
                            })
                            .catch((error) => toast.error(errorText(error)));
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
          <AppointmentForm open={open} onOpenChange={setOpen} initial={editing} date={day ?? undefined} />
        </div>
      )}
    </Shell>
  );
}
