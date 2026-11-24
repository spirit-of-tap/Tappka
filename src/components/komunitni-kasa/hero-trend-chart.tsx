"use client";

import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import type { BalancePoint } from "@/lib/komunitni-kasa/stats";

const GRADIENT_ID = "kasa-hero-balance";
const STROKE_WIDTH = 2;

/** Čárový graf zůstatku pro tmavý hero panel — bez os, mřížky a tooltipu. */
export function HeroTrendChart({ data }: { data: BalancePoint[] }) {
  return (
    <div className="h-28 w-full sm:h-36" aria-hidden>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-hero-success)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-hero-success)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            dataKey="balance"
            type="stepAfter"
            stroke="var(--color-hero-success)"
            strokeWidth={STROKE_WIDTH}
            fill={`url(#${GRADIENT_ID})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
