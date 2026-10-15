import type { ClientStatus, ContractStatus, FinanceStatus, Priority, ProjectStatus, UpdateStatus } from "./types";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const CLIENT_STATUS: { id: ClientStatus; label: string }[] = [
  { id: "ativo", label: "Ativo" },
  { id: "negociacao", label: "Em negociação" },
  { id: "inativo", label: "Inativo" },
];

export const PROJECT_STATUS: { id: ProjectStatus; label: string }[] = [
  { id: "planejamento", label: "Planejamento" },
  { id: "andamento", label: "Em andamento" },
  { id: "entregue", label: "Entregue" },
  { id: "manutencao", label: "Manutenção" },
  { id: "pausado", label: "Pausado" },
];

export const UPDATE_STATUS: { id: UpdateStatus; label: string }[] = [
  { id: "planejada", label: "Planejada" },
  { id: "andamento", label: "Em andamento" },
  { id: "entregue", label: "Entregue" },
];

export const CONTRACT_STATUS: { id: ContractStatus; label: string }[] = [
  { id: "rascunho", label: "Rascunho" },
  { id: "aguardando", label: "Aguardando assinatura" },
  { id: "assinado", label: "Assinado" },
  { id: "encerrado", label: "Encerrado" },
];

export const FINANCE_STATUS: { id: FinanceStatus; label: string }[] = [
  { id: "pendente", label: "Pendente" },
  { id: "pago", label: "Pago" },
  { id: "cancelado", label: "Cancelado" },
];

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "alta", label: "Alta" },
  { id: "normal", label: "Normal" },
  { id: "baixa", label: "Baixa" },
];

export function labelOf(list: { id: string; label: string }[], id: string): string {
  return list.find((item) => item.id === id)?.label ?? id;
}

export function saoPauloToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function monthBounds(today: string): { start: string; end: string; yearStart: string } {
  const [y, m] = today.split("-");
  const month = Number(m);
  const year = Number(y);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: `${y}-${m}-01`,
    end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
    yearStart: `${y}-01-01`,
  };
}

export function lastMonths(today: string, count: number): string[] {
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return keys.reverse();
}

export function monthLabel(ym: string): string {
  const month = Number(ym.slice(5, 7));
  return `${MONTHS[month - 1] ?? ym} ${ym.slice(2, 4)}`;
}

export function brDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!d || !m || !y) return iso;
  return `${d}/${m}/${y}`;
}

export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(dt);
}

export function whenLabel(iso: string | null, today: string): string {
  if (!iso) return "Sem data";
  const day = iso.slice(0, 10);
  if (day === today) return "Hoje";
  if (day === addDays(today, 1)) return "Amanhã";
  if (day === addDays(today, -1)) return "Ontem";
  return brDate(day);
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents || 0));
  const reais = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const grouped = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}R$ ${grouped},${frac}`;
}

export function parseMoney(input: string): number | null {
  const raw = input.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!raw) return 0;
  const norm = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) return null;
  const value = Number(norm);
  if (!Number.isFinite(value) || value < 0 || value > 20_000_000) return null;
  return Math.round(value * 100);
}

export function centsToInput(cents: number): string {
  if (!cents) return "";
  const reais = Math.floor(Math.abs(cents) / 100);
  const frac = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${reais},${frac}`;
}

export function clockLabel(date: string | null, time: string, today: string): string {
  const when = whenLabel(date, today);
  if (!time) return when;
  return `${when} às ${time}`;
}
