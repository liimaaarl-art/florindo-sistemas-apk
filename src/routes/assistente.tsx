import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button, Card, ErrorNote, PageSkeleton, TextArea } from "@/components/ui";
import { useAuthedQuery } from "@/lib/ops/query";
import { askAssistant, clearAssistant, listAssistant } from "@/lib/ops/server";
import { errorText } from "@/lib/utils";

export const Route = createFileRoute("/assistente")({
  component: AssistantPage,
});

const SUGGESTIONS = [
  "Cadastre João da Silva como novo cliente.",
  "Coloque uma tarefa para amanhã para ligar para a Jéssica.",
  "Quanto tenho para receber este mês?",
  "Quais clientes estão com pagamento pendente?",
  "Me mostre meus compromissos de amanhã.",
];

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function AssistantPage() {
  const query = useAuthedQuery(["ops", "assistant"], () => listAssistant());
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [query.data?.messages.length]);

  async function send(next: string) {
    const value = next.trim();
    if (!value) return;
    setPending(true);
    setText("");
    try {
      await askAssistant({ data: { text: value } });
      await qc.invalidateQueries({ queryKey: ["ops"] });
    } catch (error) {
      toast.error(errorText(error));
      setText(value);
    } finally {
      setPending(false);
    }
  }

  async function sendAudio(blob: Blob) {
    setPending(true);
    try {
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Não consegui ler o áudio."));
        reader.readAsDataURL(blob);
      });
      const result = await askAssistant({ data: { audioBase64, mime: blob.type || "audio/webm" } });
      toast.success("Pedido de voz interpretado.");
      if (result.transcript) toast.success(`Ouvi: ${result.transcript}`);
      await qc.invalidateQueries({ queryKey: ["ops"] });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  function stopTracks() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  async function toggleMic() {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    const mime = pickMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      const SpeechCtor = (
        window as unknown as {
          webkitSpeechRecognition?: new () => {
            lang: string;
            start: () => void;
            onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
            onerror: (() => void) | null;
          };
          SpeechRecognition?: new () => {
            lang: string;
            start: () => void;
            onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
            onerror: (() => void) | null;
          };
        }
      ).webkitSpeechRecognition ?? (
        window as unknown as {
          SpeechRecognition?: new () => {
            lang: string;
            start: () => void;
            onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
            onerror: (() => void) | null;
          };
        }
      ).SpeechRecognition;
      if (!SpeechCtor) {
        toast.error("Este navegador não liberou o microfone. Escreva o pedido.");
        return;
      }
      const recognition = new SpeechCtor();
      recognition.lang = "pt-BR";
      recognition.onresult = (event) => {
        const heard = event.results[0]?.[0]?.transcript ?? "";
        if (heard) void send(heard);
      };
      recognition.onerror = () => toast.error("Não consegui ouvir. Tente de novo.");
      recognition.start();
      toast.success("Pode falar.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mediaRecorder = new MediaRecorder(media, { mimeType: mime });
      chunks.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: mime });
        stopTracks();
        if (blob.size) void sendAudio(blob);
      };
      mediaRecorder.start();
      recorder.current = mediaRecorder;
      setRecording(true);
      window.setTimeout(() => {
        if (mediaRecorder.state === "recording") mediaRecorder.stop();
        setRecording(false);
      }, 50_000);
    } catch {
      toast.error("Permita o microfone para falar com o assistente.");
    }
  }

  const messages = query.data?.messages ?? [];

  return (
    <Shell title="Assistente">
      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorNote message="Não foi possível abrir o assistente." onRetry={() => void query.refetch()} />
      ) : (
        <div className="assistant-pane rise flex flex-col">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {query.data?.ai ? "Peça em português. A IA propõe a ação e o Nexo só grava depois de validar." : "A IA não está disponível neste ambiente."}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void clearAssistant()
                  .then(() => qc.invalidateQueries({ queryKey: ["ops", "assistant"] }))
                  .catch((error) => toast.error(errorText(error)));
              }}
            >
              Limpar
            </Button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <Card>
                <p className="mb-3 text-sm text-muted">Experimente um pedido pronto.</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((item) => (
                    <button key={item} type="button" className="rounded-full border border-line px-3 py-2 text-left text-sm hover:bg-paper" onClick={() => void send(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </Card>
            ) : messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "ml-8 rounded-2xl bg-ink px-3 py-2 text-sm text-paper" : "mr-8 rounded-2xl border border-line bg-card px-3 py-2 text-sm whitespace-pre-wrap"}>
                {message.content}
              </div>
            ))}
            <div ref={bottom} />
          </div>
          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send(text);
            }}
          >
            <TextArea value={text} onChange={(event) => setText(event.target.value)} placeholder="Peça para cadastrar, consultar ou agendar" className="min-h-12" />
            <Button type="button" variant={recording ? "danger" : "line"} size="icon" aria-label={recording ? "Parar e enviar" : "Falar"} onClick={() => void toggleMic()}>
              {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
            </Button>
            <Button type="submit" disabled={pending || recording}>{pending ? "…" : "Enviar"}</Button>
          </form>
          {recording ? <p className="mt-2 text-xs text-muted">Ouvindo… toque no quadrado para transcrever e executar.</p> : null}
        </div>
      )}
    </Shell>
  );
}
