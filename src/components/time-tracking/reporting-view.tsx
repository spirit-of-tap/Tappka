"use client"

import * as React from "react"
import { FileDown, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { DateKeyRange } from "@/lib/time-tracking/date-range"
import {
  DEFAULT_REPORT_SERIES,
  availableSeries,
  buildReportRows,
  entriesToCsv,
} from "@/lib/time-tracking/report"
import type { TeamMember, TimeEntryWithTag, TimeRange, TimeTag } from "@/lib/time-tracking/types"

import { formatRangeLabel } from "./cas-query"
import { downloadCsv, slugify } from "./chart-export"
import { ReportChartCard, type ReportChartConfig } from "./report-chart-card"

const DEFAULT_CHART_TITLE = "Čas podle směrů"
const NEW_CHART_TITLE_PREFIX = "Graf"

export interface ReportingViewProps {
  teamName: string
  members: TeamMember[]
  entries: TimeEntryWithTag[]
  /** System tags plus the team's tags (all of them, not only the viewer's shown ones). */
  tags: TimeTag[]
  range: DateKeyRange
  instants: TimeRange
  now: Date
}

function newChart(index: number): ReportChartConfig {
  return {
    id: `chart-${index}`,
    title: index === 1 ? DEFAULT_CHART_TITLE : `${NEW_CHART_TITLE_PREFIX} ${index}`,
    series: [...DEFAULT_REPORT_SERIES],
  }
}

/**
 * Reporting tab: bar charts with one column per team member and hours of the chosen
 * directions / tags on the Y axis, for the selected period; each chart exports as PNG or
 * CSV, and all entries of the period export as CSV (e.g. for an AI assistant).
 */
export function ReportingView({ teamName, members, entries, tags, range, instants, now }: ReportingViewProps) {
  const [charts, setCharts] = React.useState<ReportChartConfig[]>(() => [newChart(1)])
  const [nextIndex, setNextIndex] = React.useState(2)

  const allSeries = React.useMemo(() => availableSeries(tags), [tags])
  const rangeLabel = formatRangeLabel(range)
  const subtitle = [teamName, rangeLabel].filter(Boolean).join(" · ")
  const fileNamePrefix = ["cas", slugify(teamName), range.from, range.to].filter(Boolean).join("-")

  function addChart() {
    setCharts((current) => [...current, newChart(nextIndex)])
    setNextIndex((index) => index + 1)
  }

  function exportEntries() {
    downloadCsv(entriesToCsv({ members, entries, now }), `${fileNamePrefix}-zaznamy.csv`)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {charts.map((chart) => (
        <ReportChartCard
          key={chart.id}
          config={chart}
          rows={buildReportRows({ members, entries, series: chart.series, range: instants, now })}
          allSeries={allSeries}
          subtitle={subtitle}
          fileNamePrefix={fileNamePrefix}
          canRemove={charts.length > 1}
          onChange={(next) => setCharts((current) => current.map((candidate) => (candidate.id === next.id ? next : candidate)))}
          onRemove={() => setCharts((current) => current.filter((candidate) => candidate.id !== chart.id))}
        />
      ))}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={addChart}>
          <Plus aria-hidden />
          Přidat graf
        </Button>
        <Button type="button" variant="ghost" onClick={exportEntries}>
          <FileDown aria-hidden />
          Všechny záznamy (CSV)
        </Button>
      </div>
    </div>
  )
}
