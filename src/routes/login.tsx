import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button, PageSkeleton, TextInput, useMounted } from "@/components/ui";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function authMessage(error: { message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (/invalid email or password/i.test(message)) return "E-mail ou senha incorretos.";
  if (/already|exist/i.test(message)) return "Já existe uma conta com esse e-mail.";
  if (/password/i.test(message)) return "A senha precisa ter pelo menos 8 caracteres.";
  if (/origin/i.test(message)) return "Não foi possível validar este acesso. Tente novamente.";
  return message || "Não foi possível concluir o acesso.";
}

function LoginPage() {
  const mounted = useMounted();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nexo.email");
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, []);

  if (!mounted || isPending) {
    return (
      <main className="min-h-dvh bg-paper p-6">
        <PageSkeleton />
      </main>
    );
  }
  if (user) return <RedirectToSignIn to="/" />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setError("A confirmação da senha não confere.");
      return;
    }
    setPending(true);
    try {
      if (remember) localStorage.setItem("nexo.email", email.trim());
      else localStorage.removeItem("nexo.email");
    } catch {
      /* ignore */
    }
    const result =
      mode === "signup"
        ? await authClient.signUp.email({
            name: name.trim() || email.trim(),
            email: email.trim(),
            password,
            callbackURL: "/",
          })
        : await authClient.signIn.email({
            email: email.trim(),
            password,
            rememberMe: remember,
            callbackURL: "/",
          });
    setPending(false);
    if (result.error) {
      setError(authMessage(result.error));
      return;
    }
    await navigate({ to: "/" });
  }

  return (
    <main className="grid min-h-dvh bg-paper md:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1fr)]">
      <section className="hidden flex-col justify-between bg-ink px-10 py-12 text-paper md:flex">
        <p className="font-display text-4xl">Nexo</p>
        <div>
          <h1 className="max-w-md font-display text-5xl leading-tight">A operação inteira, visível.</h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/70">
            Clientes, projetos, contratos, caixa, tarefas e agenda na mesma conta. O que você grava aqui aparece no outro aparelho.
          </p>
        </div>
        <p className="text-xs text-paper/50">Cada conta enxerga só os próprios dados.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <p className="font-display text-4xl md:hidden">Nexo</p>
          <h2 className="mt-6 font-display text-3xl text-ink">{mode === "login" ? "Entrar" : "Criar conta"}</h2>
          <div className="mt-5 grid grid-cols-2 rounded-lg bg-ink/5 p-1">
            <button
              type="button"
              className={`h-10 rounded-md text-sm ${mode === "signup" ? "bg-card text-ink" : "text-muted"}`}
              onClick={() => {
                setMode("signup");
                setError("");
              }}
            >
              Fazer cadastro
            </button>
            <button
              type="button"
              className={`h-10 rounded-md text-sm ${mode === "login" ? "bg-card text-ink" : "text-muted"}`}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Já tenho login
            </button>
          </div>
          <form onSubmit={submit} className="mt-5 grid gap-3">
            {mode === "signup" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Seu nome</span>
                <TextInput value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              </label>
            ) : null}
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">E-mail</span>
              <TextInput
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Senha</span>
              <span className="relative">
                <TextInput
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="pr-12"
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-1 grid h-9 w-9 -translate-y-1/2 place-items-center text-muted"
                  onClick={() => setShow((value) => !value)}
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>
            {mode === "signup" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Confirmar senha</span>
                <TextInput
                  type={show ? "text" : "password"}
                  required
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                />
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-4" />
              Manter acesso salvo neste aparelho
            </label>
            {error ? <p className="text-sm text-bad">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Aguarde…" : mode === "signup" ? "Criar conta" : "Entrar"}
            </Button>
          </form>
          <div className="my-5 h-px bg-line" />
          <div className="grid gap-2">
            {GROK_PROVIDERS.map((provider) => (
              <Button
                key={provider.providerId}
                variant="line"
                onClick={() => void signIn(provider.providerId, { callbackURL: "/" })}
              >
                Continuar com {provider.label}
              </Button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
