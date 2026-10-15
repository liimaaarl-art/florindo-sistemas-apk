import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TaskForm } from "@/components/forms";
import { Shell } from "@/components/shell";
import { Badge, Button, Card, ErrorNote, PageSkeleton } from "@/components/ui";
import { clockLabel } from "@/lib/ops/format";
import { useAuthedQuery } from "@/lib/ops/query";
import { deleteTask, listTasks, toggleTask } from "@/lib/ops/server";
import type { Task } from "@/lib/ops/types";
import { errorText } from "@/lib/utils";

export const Route = createFileRoute("/tarefas")({
  component: TasksPage,
});

function TasksPage() {
  const [scope, setScope] = useState<"" | Task["scope"]>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const query = useAuthedQuery(["ops", "tasks", scope], () => listTasks({ data: { scope: scope || undefined } }));
  const qc = useQueryClient();
  const data = query.data;

  return (
    <Shell title="Tarefas">
      <div className="mb-4 flex flex-wrap gap-2">
        {([["", "Todas"], ["empresa", "Empresa"], ["pessoal", "Pessoal"]] as const).map(([id, label]) => (
          <Button key={id || "todas"} size="sm" variant={scope === id ? "primary" : "line"} onClick={() => setScope(id)}>
            {label}
          </Button>
        ))}
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>Nova tarefa</Button>
      </div>
      {query.isLoading || !data ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorNote message="Não foi possível carregar as tarefas." onRetry={() => void query.refetch()} />
      ) : (
        <div className="rise grid gap-2">
          {data.tasks.length === 0 ? <Card><p className="text-sm text-muted">Nenhuma tarefa nessa lista.</p></Card> : data.tasks.map((task) => (
            <Card key={task.id} className="flex items-start gap-3">
              <button
                type="button"
                aria-label={task.done ? "Reabrir tarefa" : "Concluir tarefa"}
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${task.done ? "border-good bg-good text-paper" : "border-line"}`}
                onClick={() => {
                  void toggleTask({ data: { id: task.id } })
                    .then(async (result) => {
                      toast.success(result.done ? "Tarefa concluída." : "Tarefa reaberta.");
                      await qc.invalidateQueries({ queryKey: ["ops"] });
                    })
                    .catch((error) => toast.error(errorText(error)));
                }}
              >
                {task.done ? "✓" : ""}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${task.done ? "text-muted line-through" : ""}`}>{task.title}</p>
                <p className="text-xs text-muted">
                  {clockLabel(task.dueOn, task.dueTime, data.today)}
                  {task.clientName ? ` · ${task.clientName}` : ""}
                  {task.projectName ? ` · ${task.projectName}` : ""}
                  {task.scope === "pessoal" ? " · Pessoal" : ""}
                </p>
              </div>
              <Badge tone={task.priority === "alta" ? "warn" : "neutral"}>{task.priority === "alta" ? "Alta" : task.priority === "baixa" ? "Baixa" : "Normal"}</Badge>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(task); setOpen(true); }}>Editar</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void deleteTask({ data: { id: task.id } })
                      .then(async () => {
                        toast.success("Tarefa excluída.");
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
      )}
      <TaskForm open={open} onOpenChange={setOpen} initial={editing} scope={scope || undefined} />
    </Shell>
  );
}
