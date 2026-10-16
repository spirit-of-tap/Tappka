"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyCashflow } from "@/lib/komunitni-kasa/stats";
import { formatCzk } from "@/lib/komunitni-kasa/stats";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const config = {
  income: { label: "Příjmy", color: "var(--color-success)" },
  expense: { label: "Výdaje", color: "var(--color-destructive)" },
} satisfies ChartConfig;

function compactCzk(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)} tis.`;
  return String(value);
}

export function CashflowChart({ data }: { data: MonthlyCashflow[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Zatím tu nejsou žádná data</p>;
  }
  return (
    <ChartContainer config={config} className="min-h-[180px] w-full sm:min-h-[240px]">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={compactCzk}
            width={48}
          />
          <Tooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <span className="font-mono font-medium tabular-nums">
                    {formatCzk(Number(value))} · {name}
                  </span>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="income" name="Příjmy" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Výdaje" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
