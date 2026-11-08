"use client"

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { toCsv } from "@/lib/time-tracking/report"
import { formatDayHeading } from "@/lib/training-sessions/format"
import {
  PREP_LEAD_BUCKET_LABELS,
  PREP_LEAD_BUCKETS,
  formatLeadTime,
  summarizePreparation,
  type PrepLeadBucket,
  type StatsSession,
} from "@/lib/training-sessions/stats"

import { STATS_CHART, StatsChartCard } from "./stats-chart-card"

const BUCKET_COLORS: Record<PrepLeadBucket, string> = {
  "3plus": "var(--success)",
  "1to3": "var(--chart-3)",
  under1: "var(--warning)",
  late: "var(--destructive)",
  missing: "var(--muted-foreground)",
}
const HOURS_FORMAT = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 })

interface PreparationSectionProps {
  sessions: StatsSession[]
  subtitle: string
  fileNamePrefix: string
}

function averageText(averageLeadHours: number | null): string {
  if (averageLeadHours === null) return "Zatím žádná příprava nebyla zveřejněná."
  const size = formatLeadTime(averageLeadHours)
  return averageLeadHours > 0 ? `V průměru ${size} předem` : `V průměru ${size} po začátku`
}

export function PreparationSection({ sessions, subtitle, fileNamePrefix }: PreparationSectionProps) {
  const { rows, buckets, averageLeadHours } = summarizePreparation(sessions)
  const data = PREP_LEAD_BUCKETS.map((bucket) => ({ bucket, label: PREP_LEAD_BUCKET_LABELS[bucket], count: buckets[bucket] }))

  return (
    <section aria-labelledby="ts-stats-preparation" className="space-y-3">
      <div>
        <h2 id="ts-stats-preparation" className="font-heading text-lg font-semibold">
          Příprava
        </h2>
        <p className="text-sm text-muted-foreground">Jak dlouho před začátkem TS byla příprava zveřejněná.</p>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{averageText(averageLeadHours)}</p>
      <StatsChartCard
        title="Předstih přípravy"
        subtitle={subtitle}
        fileNamePrefix={fileNamePrefix}
        legend={data.map((row) => ({ label: row.label, color: BUCKET_COLORS[row.bucket] }))}
        toCsv={() =>
          toCsv(
            ["Datum", "Téma", "Facilitace", "Zveřejněno", "Předstih (h)", "Kategorie"],
            rows.map((row) => [
              formatDayHeading(row.session.startsAt),
              row.session.topic,
              row.session.facilitators.map((f) => f.name ?? "").join(", "),
              row.session.preparationPublishedAt ?? "",
              row.leadHours === null ? "" : HOURS_FORMAT.format(row.leadHours),
              PREP_LEAD_BUCKET_LABELS[row.bucket],
            ]),
          )
        }
        minWidth={data.length * STATS_CHART.minColumnWidth * 2}
      >
        <ResponsiveContainer width="100%" height={STATS_CHART.height}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" interval={0} tick={STATS_CHART.tick} stroke="var(--border)" />
            <YAxis width={STATS_CHART.yAxisWidth} allowDecimals={false} tick={STATS_CHART.tick} stroke="var(--border)" />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              formatter={(value) => [value, "TS"]}
              contentStyle={STATS_CHART.tooltipStyle}
              itemStyle={STATS_CHART.tooltipItemStyle}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={STATS_CHART.maxBarSize} isAnimationActive={false}>
              {data.map((row) => (
                <Cell key={row.bucket} fill={BUCKET_COLORS[row.bucket]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </StatsChartCard>
    </section>
  )
}
