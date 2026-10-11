"use client"

import * as React from "react"
import { ChevronDown, FileSpreadsheet, ImageDown, Trash2 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { shortName } from "@/lib/string-utils"
import { TIME_DIRECTIONS, TIME_TRACKING_MESSAGES } from "@/lib/time-tracking/constants"
import {
  reportRowsToCsv,
  seriesLabel,
  type ReportRow,
  type ReportSeries,
  type ReportSeriesKey,
} from "@/lib/time-tracking/report"
import type { TimeDirection } from "@/lib/time-tracking/types"
import { cn } from "@/lib/utils"

import { downloadCsv, exportChartAsPng, slugify } from "./chart-export"

/** Tags get chart palette colours in turn; directions keep their own tokens. */
const TAG_PALETTE = ["var(--chart-3)", "var(--chart-2)", "var(--chart-4)", "var(--chart-1)", "var(--chart-5)"] as const
const CHART_HEIGHT = 360
/** Minimum width per member column before the chart scrolls sideways (phones). */
const MIN_COLUMN_WIDTH = 44
const X_AXIS_HEIGHT = 72
const X_AXIS_ANGLE = -35
const Y_AXIS_WIDTH = 48
const AXIS_FONT_SIZE = 11
const HOURS_FORMAT = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 })
const TITLE_MAX_LENGTH = 80

export interface ReportChartConfig {
  id: string
  title: string
  series: ReportSeriesKey[]
}

export function seriesColor(key: ReportSeriesKey, seriesKeys: readonly ReportSeriesKey[]): string {
  if (key.startsWith("direction:")) return `var(--time-${key.slice("direction:".length)})`
  const tagIndex = seriesKeys.filter((candidate) => candidate.startsWith("tag:")).indexOf(key)
  return TAG_PALETTE[tagIndex % TAG_PALETTE.length] ?? TAG_PALETTE[0]
}

export function formatHours(hours: number): string {
  return `${HOURS_FORMAT.format(hours)} h`
}

interface ReportChartCardProps {
  config: ReportChartConfig
  rows: readonly ReportRow[]
  allSeries: readonly ReportSeries[]
  /** E.g. „PAVIAAN · 5.–11. 10. 2026" — shown under the title in the PNG. */
  subtitle: string
  /** Prefix for exported file names (team + period). */
  fileNamePrefix: string
  canRemove: boolean
  onChange: (config: ReportChartConfig) => void
  onRemove: () => void
}

export function ReportChartCard({
  config,
  rows,
  allSeries,
  subtitle,
  fileNamePrefix,
  canRemove,
  onChange,
  onRemove,
}: ReportChartCardProps) {
  const chartRef = React.useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = React.useState(false)
  const titleId = React.useId()

  const legend = config.series.map((key) => ({ label: seriesLabel(key, allSeries), color: seriesColor(key, config.series) }))
  const data = [...rows]
    .sort((a, b) => b.totalHours - a.totalHours)
    .map((row) => ({ name: shortName(row.memberName), fullName: row.memberName, ...row.hours }))
  const fileName = `${fileNamePrefix}-${slugify(config.title) || "graf"}`

  function toggleSeries(key: ReportSeriesKey, checked: boolean) {
    // Keep the picker's order (directions, then tags by direction) whatever the click order.
    const next = checked ? [...config.series, key] : config.series.filter((candidate) => candidate !== key)
    const order = new Map(allSeries.map((series, index) => [series.key, index]))
    onChange({ ...config, series: next.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)) })
  }

  async function exportPng() {
    if (!chartRef.current) return
    setIsExporting(true)
    try {
      await exportChartAsPng({
        container: chartRef.current,
        title: config.title,
        subtitle,
        legend,
        fileName: `${fileName}.png`,
      })
    } catch {
      toast.error(TIME_TRACKING_MESSAGES.generic)
    } finally {
      setIsExporting(false)
    }
  }

  function exportCsv() {
    downloadCsv(reportRowsToCsv(rows, config.series, allSeries), `${fileName}.csv`)
  }

  return (
    <section aria-labelledby={titleId} className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label id={titleId} className="sr-only" htmlFor={`${titleId}-input`}>
          Název grafu
        </label>
        <Input
          id={`${titleId}-input`}
          value={config.title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(event) => onChange({ ...config, title: event.target.value })}
          className="h-9 border-transparent px-2 text-base font-semibold shadow-none hover:border-input focus-visible:border-input sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <SeriesPicker allSeries={allSeries} selected={config.series} onToggle={toggleSeries} />
          <Button type="button" variant="outline" size="sm" onClick={() => void exportPng()} disabled={isExporting || config.series.length === 0}>
            <ImageDown aria-hidden />
            PNG
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={config.series.length === 0}>
            <FileSpreadsheet aria-hidden />
            CSV
          </Button>
          {canRemove && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Odebrat graf ${config.title}`}>
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {config.series.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Vyber, co se má na ose Y sčítat.</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legenda">
            {legend.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                {item.label}
              </li>
            ))}
          </ul>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div ref={chartRef} style={{ minWidth: data.length * MIN_COLUMN_WIDTH }}>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={X_AXIS_ANGLE}
                    textAnchor="end"
                    height={X_AXIS_HEIGHT}
                    tick={{ fontSize: AXIS_FONT_SIZE, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                  />
                  <YAxis
                    width={Y_AXIS_WIDTH}
                    tickFormatter={(value: number) => HOURS_FORMAT.format(value)}
                    unit=" h"
                    tick={{ fontSize: AXIS_FONT_SIZE, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    formatter={(value) => formatHours(Number(value))}
                    labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.fullName ?? _label)}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                  {config.series.map((key, index) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={seriesLabel(key, allSeries)}
                      stackId="hours"
                      fill={seriesColor(key, config.series)}
                      radius={index === config.series.length - 1 ? [4, 4, 0, 0] : 0}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

interface SeriesPickerProps {
  allSeries: readonly ReportSeries[]
  selected: readonly ReportSeriesKey[]
  onToggle: (key: ReportSeriesKey, checked: boolean) => void
}

/** Y-axis picker: whole directions, then tags grouped by direction. */
function SeriesPicker({ allSeries, selected, onToggle }: SeriesPickerProps) {
  const directions = allSeries.filter((series) => series.key.startsWith("direction:"))
  const tagsByDirection = TIME_DIRECTIONS.map((direction) => ({
    direction,
    tags: allSeries.filter((series) => series.key.startsWith("tag:") && series.direction === direction.value),
  })).filter((group) => group.tags.length > 0)

  function item(series: ReportSeries, dotDirection?: TimeDirection) {
    const dot = TIME_DIRECTIONS.find((direction) => direction.value === dotDirection)
    return (
      <DropdownMenuCheckboxItem
        key={series.key}
        checked={selected.includes(series.key)}
        onCheckedChange={(checked) => onToggle(series.key, checked === true)}
        // Keep the menu open so several series can be ticked in a row.
        onSelect={(event) => event.preventDefault()}
      >
        {dot && <span aria-hidden className={cn("size-2 rounded-full", dot.dotClass)} />}
        <span className="truncate">{series.label}</span>
      </DropdownMenuCheckboxItem>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Osa Y: {selected.length === 0 ? "nic" : selected.length}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-64 overflow-y-auto">
        <DropdownMenuLabel>Směry</DropdownMenuLabel>
        {directions.map((series) => item(series, series.direction))}
        {tagsByDirection.map((group) => (
          <React.Fragment key={group.direction.value}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2 rounded-full", group.direction.dotClass)} />
              Tagy · {group.direction.label}
            </DropdownMenuLabel>
            {group.tags.map((series) => item(series))}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
