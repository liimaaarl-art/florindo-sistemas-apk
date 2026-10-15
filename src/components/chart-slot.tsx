import { useEffect, useState, type ComponentType } from "react";
import type { MonthPoint } from "@/lib/ops/types";

export function ChartSlot({ data }: { data: MonthPoint[] }) {
  const [Chart, setChart] = useState<ComponentType<{ data: MonthPoint[] }> | null>(null);
  useEffect(() => {
    void import("@/components/finance-chart").then((mod) => setChart(() => mod.FinanceChart));
  }, []);
  if (!Chart) return <div className="h-52 rounded-2xl bg-ink/5" />;
  return <Chart data={data} />;
}
