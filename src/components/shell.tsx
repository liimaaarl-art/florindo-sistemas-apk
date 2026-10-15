import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Calendar,
  CheckSquare,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  AppointmentForm,
  ClientForm,
  ContractForm,
  FinanceForm,
  ProjectForm,
  TaskForm,
  UpdateForm,
} from "@/components/forms";
import { Button, PageSkeleton, useMounted } from "@/components/ui";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/contratos", label: "Contratos", icon: FileText },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/assistente", label: "Assistente", icon: MessageSquare },
] as const;

const QUICK = [
  { id: "client", label: "Novo cliente" },
  { id: "project", label: "Novo projeto" },
  { id: "task", label: "Nova tarefa" },
  { id: "appointment", label: "Novo compromisso" },
  { id: "entrada", label: "Nova entrada" },
  { id: "saida", label: "Nova saída" },
  { id: "update", label: "Nova atualização" },
  { id: "contract", label: "Novo contrato" },
] as const;

type QuickId = (typeof QUICK)[number]["id"] | null;

const subscribe = () => () => {};

function active(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const mounted = useMounted();
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState<QuickId>(null);
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const current = useCurrentUser();
  const gate = useSyncExternalStore(subscribe, hasGateSessionMarker, () => false);
  const [signingOut, setSigningOut] = useState(false);

  if (!mounted || isPending) {
    return (
      <div className="min-h-dvh bg-paper p-6">
        <PageSkeleton />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  const name = current?.displayName || current?.primaryEmail || "Conta";

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-ink text-paper md:flex">
        <Link to="/" className="px-5 pt-6 pb-4">
          <span className="font-display text-3xl tracking-tight">Nexo</span>
          <span className="mt-1 block text-xs text-paper/60">Gestão da operação</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const on = active(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm",
                  on ? "bg-paper text-ink" : "text-paper/75 hover:bg-paper/10 hover:text-paper",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/ajustes"
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-sm",
              active(pathname, "/ajustes") ? "bg-paper text-ink" : "text-paper/75 hover:bg-paper/10",
            )}
          >
            <Settings className="size-4" />
            Ajustes
          </Link>
        </nav>
        <div className="border-t border-paper/10 px-4 py-4">
          <p className="truncate text-sm font-medium">{name}</p>
          {authEnabled && !gate ? (
            <button
              type="button"
              className="mt-2 text-sm text-paper/70 hover:text-paper disabled:opacity-60"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut()
                  .then(() => navigate({ to: "/login" }))
                  .catch(() => setSigningOut(false));
              }}
            >
              {signingOut ? "Saindo…" : "Sair"}
            </button>
          ) : null}
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-paper/95 px-4 py-3">
          <h1 className="font-display text-2xl leading-none text-ink">{title}</h1>
          <form
            className="ml-auto hidden min-w-0 md:block"
            onSubmit={(event) => {
              event.preventDefault();
              void navigate({ to: "/busca", search: { q: query } });
            }}
          >
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar"
                className="h-11 w-56 rounded-lg border border-line bg-card pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-ink/10 lg:w-72"
              />
            </label>
          </form>
          <Link to="/busca" search={{ q: "" }} className="ml-auto grid h-11 w-11 place-items-center rounded-lg border border-line bg-card md:hidden" aria-label="Buscar">
            <Search className="size-4" />
          </Link>
          <div className="relative">
            <Button variant="primary" size="sm" onClick={() => setMenu((value) => !value)} aria-expanded={menu}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
            {menu ? (
              <div className="rise absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-line bg-card p-1 shadow-[0_12px_40px_rgba(26,28,30,0.08)]">
                {QUICK.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-paper"
                    onClick={() => {
                      setQuick(item.id);
                      setMenu(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </header>
        <main className="px-4 py-4 pb-28 md:px-8 md:py-6 md:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5">
          {NAV.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const on = active(pathname, item.to);
            return (
              <Link key={item.to} to={item.to} className={cn("grid h-16 place-items-center gap-1 text-xs", on ? "text-ink" : "text-muted")}>
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
          <button type="button" className="grid h-16 place-items-center gap-1 text-xs text-muted" onClick={() => setMore(true)}>
            <Menu className="size-5" />
            Mais
          </button>
        </div>
      </nav>

      {more ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Fechar menu" onClick={() => setMore(false)} />
          <div className="rise absolute inset-x-0 bottom-0 rounded-t-3xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-2xl">Mais</p>
              <button type="button" className="grid h-11 w-11 place-items-center" aria-label="Fechar" onClick={() => setMore(false)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="grid gap-1">
              {[...NAV.slice(4), { to: "/ajustes", label: "Ajustes", icon: Settings }].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMore(false)}
                    className="flex h-12 items-center gap-3 rounded-lg px-2 text-sm"
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
              <p className="mt-3 truncate px-2 text-sm text-muted">{name}</p>
              {authEnabled && !gate ? (
                <button
                  type="button"
                  className="flex h-12 items-center px-2 text-sm"
                  onClick={() => {
                    setSigningOut(true);
                    void signOut()
                      .then(() => navigate({ to: "/login" }))
                      .catch(() => setSigningOut(false));
                  }}
                >
                  {signingOut ? "Saindo…" : "Sair"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ClientForm open={quick === "client"} onOpenChange={(open) => setQuick(open ? "client" : null)} />
      <ProjectForm open={quick === "project"} onOpenChange={(open) => setQuick(open ? "project" : null)} />
      <TaskForm open={quick === "task"} onOpenChange={(open) => setQuick(open ? "task" : null)} />
      <AppointmentForm open={quick === "appointment"} onOpenChange={(open) => setQuick(open ? "appointment" : null)} />
      <FinanceForm open={quick === "entrada"} kind="entrada" onOpenChange={(open) => setQuick(open ? "entrada" : null)} />
      <FinanceForm open={quick === "saida"} kind="saida" onOpenChange={(open) => setQuick(open ? "saida" : null)} />
      <UpdateForm open={quick === "update"} onOpenChange={(open) => setQuick(open ? "update" : null)} />
      <ContractForm open={quick === "contract"} onOpenChange={(open) => setQuick(open ? "contract" : null)} />
    </div>
  );
}
