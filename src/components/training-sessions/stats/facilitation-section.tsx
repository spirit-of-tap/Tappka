"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { shortName } from "@/lib/string-utils"
import { toCsv } from "@/lib/time-tracking/report"
import { countFacilitations, type StatsPerson, type StatsSession } from "@/lib/training-sessions/stats"

import { STATS_CHART, StatsChartCard } from "./stats-chart-card"

const UNNAMED = "Bez jména"
const FORMER_SUFFIX = " · už není v týmu"
const FACILITATION_COLOR = "var(--chart-1)"

interface FacilitationSectionProps {
  sessions: StatsSession[]
  members: StatsPerson[]
  subtitle: string
  fileNamePrefix: string
}

export function FacilitationSection({ sessions, members, subtitle, fileNamePrefix }: FacilitationSectionProps) {
  const rows = countFacilitations(sessions, members)
  const data = rows.map((row) => {
    const fullName = `${row.person.name ?? UNNAMED}${row.isFormerMember ? FORMER_SUFFIX : ""}`
    return { name: shortName(row.person.name ?? UNNAMED), fullName, count: row.count }
  })

  return (
    <section aria-labelledby="ts-stats-facilitation" className="space-y-3">
      <div>
        <h2 id="ts-stats-facilitation" className="font-heading text-lg font-semibold">
          Facilitace
        </h2>
        <p className="text-sm text-muted-foreground">Kolikrát kdo z týmu facilitoval TS v tomhle období.</p>
      </div>
      <StatsChartCard
        title="Počet facilitací"
        subtitle={subtitle}
        fileNamePrefix={fileNamePrefix}
        legend={[{ label: "Facilitace", color: FACILITATION_COLOR }]}
        toCsv={() => toCsv(["Člen:ka", "Počet facilitací"], data.map((row) => [row.fullName, row.count]))}
        minWidth={data.length * STATS_CHART.minColumnWidth}
      >
        <ResponsiveContainer width="100%" height={STATS_CHART.height}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" interval={0} tick={STATS_CHART.tick} stroke="var(--border)" />
            <YAxis width={STATS_CHART.yAxisWidth} allowDecimals={false} tick={STATS_CHART.tick} stroke="var(--border)" />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              labelFormatter={(label, payload) => String(payload?.[0]?.payload?.fullName ?? label)}
              formatter={(value) => [value, "Facilitací"]}
              contentStyle={STATS_CHART.tooltipStyle}
              itemStyle={STATS_CHART.tooltipItemStyle}
            />
            <Bar dataKey="count" fill={FACILITATION_COLOR} radius={[4, 4, 0, 0]} maxBarSize={STATS_CHART.maxBarSize} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </StatsChartCard>
    </section>
  )
}
