import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonStyles = cva(
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-[background-color,opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink text-paper hover:bg-ink-soft",
        line: "border border-line bg-card text-ink hover:bg-paper",
        ghost: "bg-transparent text-ink hover:bg-ink/5",
        danger: "bg-bad/10 text-bad hover:bg-bad/15",
      },
      size: {
        md: "h-11 px-4",
        sm: "h-9 px-3 text-sm",
        icon: "h-11 w-11 px-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonStyles>) {
  return <button type={type} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}

export const fieldClass =
  "h-11 w-full rounded-lg border border-line bg-card px-3 text-base text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted/80 focus:border-ink/30 focus:ring-2 focus:ring-ink/10";

export function TextInput(props: React.ComponentProps<"input">) {
  return <input {...props} className={cn(fieldClass, props.className)} />;
}

export function TextArea(props: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn(fieldClass, "h-auto min-h-24 py-2 leading-normal", props.className)}
    />
  );
}

export function SelectInput(props: React.ComponentProps<"select">) {
  return <select {...props} className={cn(fieldClass, "appearance-none", props.className)} />;
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <span className="font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="rise fixed z-50 inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-card p-4 outline-none md:inset-auto md:top-1/2 md:left-1/2 md:w-[min(36rem,calc(100%-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="font-display text-2xl leading-tight text-ink">{title}</Dialog.Title>
            <Dialog.Close
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "bg-ink/5 text-ink",
    good: "bg-good/10 text-good",
    warn: "bg-warn/10 text-warn",
    bad: "bg-bad/10 text-bad",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function statusTone(status: string): "neutral" | "good" | "warn" | "bad" {
  if (["ativo", "entregue", "assinado", "pago", "concluido"].includes(status)) return "good";
  if (["negociacao", "andamento", "manutencao", "aguardando", "pendente", "planejada", "planejamento", "alta"].includes(status))
    return "warn";
  if (["inativo", "cancelado", "encerrado", "pausado"].includes(status)) return "bad";
  return "neutral";
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-3xl border border-line bg-card p-4", className)}>{children}</section>;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="grid justify-items-start gap-3 py-8">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <p className="max-w-md text-sm text-muted">{body}</p>
      {action}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-ink/5", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="grid gap-3">
      <p className="text-sm text-bad">{message}</p>
      {onRetry ? (
        <Button variant="line" onClick={onRetry}>
          Tentar de novo
        </Button>
      ) : null}
    </Card>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  danger,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title}>
      <p className="mb-4 text-sm text-muted">{body}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="line" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button variant={danger ? "danger" : "primary"} disabled={pending} onClick={onConfirm}>
          {pending ? "Aguarde…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
