"use client"

import { useSyncExternalStore } from "react"
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { RocketSectionRadarPoint } from "@/lib/rocket-model/progress"
import { cn } from "@/lib/utils"

export type RadarMetricMode = "both" | "team_only" | "average_only" | "all"

export interface RocketRadarChartProps {
  data: RocketSectionRadarPoint[]
  metricMode?: RadarMetricMode
  className?: string
  containerClassName?: string
}

const RADAR_CHART_CONFIG = {
  teamCheckedPercent: {
    label: "Potvrzeno týmem",
    color: "var(--primary)",
  },
  memberAveragePercent: {
    label: "Průměr členů:ek",
    color: "var(--info)",
  },
  unanimousPercent: {
    label: "Shoda týmu (100 %)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
  mediaQuery.addEventListener("change", callback)
  return () => mediaQuery.removeEventListener("change", callback)
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function getReducedMotionServerSnapshot(): boolean {
  return false
}

export function RocketRadarChart({
  data,
  metricMode = "both",
  className,
  containerClassName,
}: RocketRadarChartProps) {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  )

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Žádná data pro zobrazení grafu
      </div>
    )
  }

  const showTeam =
    metricMode === "both" || metricMode === "team_only" || metricMode === "all"
  const showAverage =
    metricMode === "both" || metricMode === "average_only" || metricMode === "all"
  const showUnanimous = metricMode === "all"

  return (
    <div className={cn("relative w-full", className)}>
      <ChartContainer
        config={RADAR_CHART_CONFIG}
        className={cn(
          "mx-auto aspect-square w-full",
          containerClassName ?? "max-h-[360px] sm:max-h-[400px]",
        )}
      >
        <RadarChart
          data={data}
          margin={{ top: 16, right: 24, bottom: 16, left: 24 }}
        >
          <PolarGrid className="stroke-border/60" />
          <PolarAngleAxis
            dataKey="code"
            tick={({ payload, x, y, cx }) => (
              <text
                x={x}
                y={y}
                textAnchor={x > cx ? "start" : x < cx ? "end" : "middle"}
                dominantBaseline="central"
                className="fill-muted-foreground text-[11px] font-semibold tracking-wide"
              >
                {payload?.value}
              </text>
            )}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            stroke="var(--border)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickFormatter={(v: number) => `${v} %`}
            tickCount={5}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_label, payload) => {
                  const point = payload?.[0]?.payload as
                    | RocketSectionRadarPoint
                    | undefined
                  if (!point) return null
                  return (
                    <div className="space-y-0.5 border-b border-border/50 pb-1 mb-1">
                      <p className="font-heading font-semibold text-foreground text-xs">
                        {point.code}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-normal leading-tight">
                        {point.title}
                      </p>
                    </div>
                  )
                }}
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {value} %
                    </span>
                  </div>
                )}
              />
            }
          />
          {showTeam && (
            <Radar
              name="Potvrzeno týmem"
              dataKey="teamCheckedPercent"
              stroke="var(--color-teamCheckedPercent)"
              fill="var(--color-teamCheckedPercent)"
              fillOpacity={0.4}
              strokeWidth={2}
              isAnimationActive={!prefersReducedMotion}
            />
          )}
          {showAverage && (
            <Radar
              name="Průměr členů:ek"
              dataKey="memberAveragePercent"
              stroke="var(--color-memberAveragePercent)"
              fill="var(--color-memberAveragePercent)"
              fillOpacity={0.25}
              strokeWidth={2}
              isAnimationActive={!prefersReducedMotion}
            />
          )}
          {showUnanimous && (
            <Radar
              name="Shoda týmu (100 %)"
              dataKey="unanimousPercent"
              stroke="var(--color-unanimousPercent)"
              fill="var(--color-unanimousPercent)"
              fillOpacity={0.15}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              isAnimationActive={!prefersReducedMotion}
            />
          )}
        </RadarChart>
      </ChartContainer>
    </div>
  )
}
