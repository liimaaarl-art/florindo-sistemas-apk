import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button, Card, ConfirmDialog } from "@/components/ui";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { exportBackup, importBackup, previewImport } from "@/lib/ops/server";
import { errorText } from "@/lib/utils";

export const Route = createFileRoute("/ajustes")({
  component: SettingsPage,
});

type Preview = {
  counts: Record<string, number>;
  payload: unknown;
};

function SettingsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function download() {
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "nexo-backup.json";
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("Backup exportado.");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const result = await previewImport({ data: { payload } });
      setPreview({ counts: result.counts, payload });
      toast.success("Arquivo válido. Confira os números antes de importar.");
    } catch (error) {
      setPreview(null);
      toast.error(error instanceof SyntaxError ? "O arquivo não é um JSON válido." : errorText(error));
    }
  }

  async function runImport() {
    if (!preview) return;
    setPending(true);
    try {
      await importBackup({ data: { payload: preview.payload, mode } });
      toast.success(mode === "replace" ? "Dados substituídos pelo backup." : "Backup acrescentado à conta.");
      setPreview(null);
      setConfirm(false);
      await qc.invalidateQueries({ queryKey: ["ops"] });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Shell title="Ajustes">
      <div className="rise grid max-w-xl gap-4">
        <Card>
          <p className="text-sm text-muted">Conta</p>
          <p className="mt-1 font-medium">{user?.displayName || "Sem nome"}</p>
          <p className="text-sm text-muted">{user?.primaryEmail}</p>
          {authEnabled ? (
            <Button
              className="mt-4"
              variant="line"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut()
                  .then(() => navigate({ to: "/login" }))
                  .catch(() => setSigningOut(false));
              }}
            >
              {signingOut ? "Saindo…" : "Sair"}
            </Button>
          ) : null}
        </Card>
        <Card className="grid gap-3">
          <h2 className="font-display text-2xl">Backup</h2>
          <p className="text-sm text-muted">O arquivo JSON traz clientes, projetos, versões, contratos, financeiro, tarefas e agenda desta conta.</p>
          <Button onClick={() => void download()}>Exportar backup</Button>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Importar arquivo</span>
            <input type="file" accept="application/json,.json" className="text-sm" onChange={(event) => void onFile(event.target.files?.[0])} />
          </label>
          {preview ? (
            <div className="grid gap-2 text-sm">
              <p>Arquivo válido.</p>
              <ul className="text-muted">
                {Object.entries(preview.counts).map(([key, value]) => (
                  <li key={key}>{key}: {value}</li>
                ))}
              </ul>
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === "merge"} onChange={() => setMode("merge")} />
                Acrescentar aos dados atuais
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />
                Substituir tudo desta conta
              </label>
              <Button onClick={() => (mode === "replace" ? setConfirm(true) : void runImport())} disabled={pending}>
                {pending ? "Importando…" : "Importar"}
              </Button>
            </div>
          ) : null}
        </Card>
        <Card>
          <h2 className="font-display text-2xl">Celular</h2>
          <p className="mt-2 text-sm text-muted">
            A interface já é pensada para o toque. Para virar aplicativo Android, o projeto inclui a configuração do Capacitor com internet e microfone, apontando para o endereço seguro publicado.
          </p>
        </Card>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Substituir os dados?"
        body="Os registros atuais desta conta serão apagados e trocados pelo arquivo."
        confirmLabel="Substituir"
        danger
        pending={pending}
        onConfirm={() => void runImport()}
      />
    </Shell>
  );
}
