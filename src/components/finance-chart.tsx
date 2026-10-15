import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCents } from "@/lib/ops/format";
import type { MonthPoint } from "@/lib/ops/types";

export function FinanceChart({ data }: { data: MonthPoint[] }) {
  const rows = data.map((point) => ({
    label: point.label,
    entrada: point.entrada / 100,
    saida: point.saida / 100,
  }));
  return (
    <div className="h-52 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            formatter={(value, name) => [
              formatCents(Math.round(Number(value ?? 0) * 100)),
              name === "saida" ? "Saídas" : "Entradas",
            ]}
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-line)",
              borderRadius: 12,
              color: "var(--color-ink)",
            }}
          />
          <Area type="monotone" dataKey="entrada" stroke="var(--color-ink)" fill="var(--color-ink)" fillOpacity={0.12} strokeWidth={2} />
          <Area type="monotone" dataKey="saida" stroke="var(--color-muted)" fill="var(--color-muted)" fillOpacity={0.1} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
