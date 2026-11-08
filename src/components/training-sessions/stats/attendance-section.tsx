"use client"

import { Lock } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { shortName } from "@/lib/string-utils"
import { toCsv } from "@/lib/time-tracking/report"
import {
  ATTENDANCE_STATS_STATUSES,
  summarizeTeamAttendance,
  type AttendanceStatsStatus,
  type StatsPerson,
  type StatsSession,
} from "@/lib/training-sessions/stats"

import { STATS_CHART, StatsChartCard } from "./stats-chart-card"

const UNNAMED = "Bez jména"
const PERCENT = 100
const STATUS_LABELS: Record<AttendanceStatsStatus, string> = {
  present: "Přítomno",
  late: "Pozdě",
  excused: "Omluveno",
  absent: "Nepřítomno",
}
const STATUS_COLORS: Record<AttendanceStatsStatus, string> = {
  present: "var(--success)",
  late: "var(--warning)",
  excused: "var(--chart-3)",
  absent: "var(--destructive)",
}
const RATE_COLOR = "var(--chart-1)"
const SHORT_DATE = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", timeZone: "Europe/Prague" })

export const ATTENDANCE_HIDDEN_NOTE = "Docházku vidí jen členové:ky týmu."

interface AttendanceSectionProps {
  sessions: StatsSession[]
  members: StatsPerson[]
  subtitle: string
  fileNamePrefix: string
  visible: boolean
}

function percent(rate: number | null): string {
  return rate === null ? "" : `${Math.round(rate * PERCENT)} %`
}

export function AttendanceSection({ sessions, members, subtitle, fileNamePrefix, visible }: AttendanceSectionProps) {
  const header = (
    <div>
      <h2 id="ts-stats-attendance" className="font-heading text-lg font-semibold">
        Docházka
      </h2>
      <p className="text-sm text-muted-foreground">Kdo na TS chodí. Počítají se jen TS s vyplněnou docházkou.</p>
    </div>
  )

  if (!visible) {
    return (
      <section aria-labelledby="ts-stats-attendance" className="space-y-3">
        {header}
        <p className="flex items-center gap-2 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden />
          {ATTENDANCE_HIDDEN_NOTE}
        </p>
      </section>
    )
  }

  const { perMember, overTime, unrecordedCount } = summarizeTeamAttendance(sessions, members)
  const perMemberData = perMember.map((row) => ({
    name: shortName(row.person.name ?? UNNAMED),
    fullName: `${row.person.name ?? UNNAMED} · ${percent(row.rate)}`,
    ...row.counts,
  }))
  const overTimeData = overTime.map((point) => ({
    date: SHORT_DATE.format(new Date(point.session.startsAt)),
    topic: point.session.topic,
    rate: Math.round(point.rate * PERCENT),
  }))

  return (
    <section aria-labelledby="ts-stats-attendance" className="space-y-3">
      {header}
      {unrecordedCount > 0 && (
        <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning-strong">{unrecordedCount} TS bez vyplněné docházky</p>
      )}
      {overTime.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Docházka zatím není vyplněná.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <StatsChartCard
            title="Účast podle lidí"
            subtitle={subtitle}
            fileNamePrefix={fileNamePrefix}
            legend={ATTENDANCE_STATS_STATUSES.map((status) => ({ label: STATUS_LABELS[status], color: STATUS_COLORS[status] }))}
            toCsv={() =>
              toCsv(
                ["Člen:ka", ...ATTENDANCE_STATS_STATUSES.map((status) => STATUS_LABELS[status]), "Účast %"],
                perMember.map((row) => [
                  row.person.name ?? UNNAMED,
                  ...ATTENDANCE_STATS_STATUSES.map((status) => row.counts[status]),
                  row.rate === null ? "" : Math.round(row.rate * PERCENT),
                ]),
              )
            }
            minWidth={perMemberData.length * STATS_CHART.minColumnWidth}
          >
            <ResponsiveContainer width="100%" height={STATS_CHART.height}>
              <BarChart data={perMemberData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" interval={0} tick={STATS_CHART.tick} stroke="var(--border)" />
                <YAxis width={STATS_CHART.yAxisWidth} allowDecimals={false} tick={STATS_CHART.tick} stroke="var(--border)" />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  labelFormatter={(label, payload) => String(payload?.[0]?.payload?.fullName ?? label)}
                  contentStyle={STATS_CHART.tooltipStyle}
              itemStyle={STATS_CHART.tooltipItemStyle}
                />
                {ATTENDANCE_STATS_STATUSES.map((status) => (
                  <Bar
                    key={status}
                    dataKey={status}
                    name={STATUS_LABELS[status]}
                    stackId="attendance"
                    fill={STATUS_COLORS[status]}
                    maxBarSize={STATS_CHART.maxBarSize} isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </StatsChartCard>
          <StatsChartCard
            title="Účast v čase"
            subtitle={subtitle}
            fileNamePrefix={fileNamePrefix}
            legend={[{ label: "Účast týmu", color: RATE_COLOR }]}
            toCsv={() => toCsv(["Datum", "Téma", "Účast %"], overTimeData.map((row) => [row.date, row.topic, row.rate]))}
          >
            <ResponsiveContainer width="100%" height={STATS_CHART.height}>
              <LineChart data={overTimeData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tick={STATS_CHART.tick} stroke="var(--border)" />
                <YAxis width={STATS_CHART.percentAxisWidth} domain={[0, PERCENT]} unit=" %" tick={STATS_CHART.tick} stroke="var(--border)" />
                <Tooltip
                  labelFormatter={(label, payload) => `${label} · ${String(payload?.[0]?.payload?.topic ?? "")}`}
                  formatter={(value) => [`${value} %`, "Účast"]}
                  contentStyle={STATS_CHART.tooltipStyle}
              itemStyle={STATS_CHART.tooltipItemStyle}
                />
                <Line dataKey="rate" stroke={RATE_COLOR} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </StatsChartCard>
        </div>
      )}
    </section>
  )
}
