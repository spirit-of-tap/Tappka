"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BalancePoint } from "@/lib/komunitni-kasa/stats";
import { formatCzk } from "@/lib/komunitni-kasa/stats";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const monthTick = new Intl.DateTimeFormat("cs-CZ", { month: "numeric", year: "2-digit" });

const config = {
  balance: { label: "Zůstatek", color: "var(--color-primary)" },
} satisfies ChartConfig;

export function BalanceTrendChart({ data }: { data: BalancePoint[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Zatím tu nejsou žádná data</p>;
  }
  return (
    <ChartContainer config={config} className="h-40 w-full sm:h-48">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="kasa-balance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => monthTick.format(new Date(t))}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} tis.` : `${v}`)}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => String(payload?.[0]?.payload?.label ?? "")}
                formatter={(value) => (
                  <span className="font-mono font-medium tabular-nums">{formatCzk(Number(value))}</span>
                )}
              />
            }
          />
          <Area
            dataKey="balance"
            name="Zůstatek"
            type="stepAfter"
            stroke="var(--color-balance)"
            fill="url(#kasa-balance)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
