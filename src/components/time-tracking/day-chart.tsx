import { cs } from "date-fns/locale"
import { format } from "date-fns"

import { formatMetricValue } from "@/lib/metrics/config"
import { MS_PER_HOUR, TIME_DIRECTIONS } from "@/lib/time-tracking/constants"
import type { DayBreakdown } from "@/lib/time-tracking/day-breakdown"
import { cn } from "@/lib/utils"

import { dateFromKey, formatDayHeading } from "./cas-query"

/** Ranges longer than this hide the chart: bars get too thin to read. */
export const MAX_CHART_DAYS = 14
export const CHART_MAX_BAR_HEIGHT_PX = 96
const MIN_BAR_HEIGHT_PX = 4
const WEEK_DAYS = 7

interface DayChartProps {
  days: DayBreakdown[]
  todayKey: string
  className?: string
}

function hoursText(ms: number): string {
  return formatMetricValue(ms / MS_PER_HOUR, "hours")
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function barLabel(dateKey: string, dayCount: number): string {
  const date = dateFromKey(dateKey)
  return dayCount <= WEEK_DAYS ? capitalize(format(date, "EEEEEE", { locale: cs })) : String(date.getDate())
}

function daySummary(day: DayBreakdown): string {
  const parts = TIME_DIRECTIONS.filter((direction) => day.byDirection[direction.value] > 0).map(
    (direction) => `${direction.label} ${hoursText(day.byDirection[direction.value])}`,
  )
  const heading = capitalize(formatDayHeading(day.dateKey))
  return parts.length > 0 ? `${heading} ${hoursText(day.totalMs)}: ${parts.join(", ")}` : `${heading} 0 h`
}

/** Stacked bars (one per day, split by direction) on the hero surface; the text alternative is a visually hidden list. */
export function DayChart({ days, todayKey, className }: DayChartProps) {
  const maxMs = Math.max(...days.map((day) => day.totalMs), 0)

  return (
    <div className={className}>
      <ul className="sr-only" aria-label="Čas po dnech">
        {days.map((day) => (
          <li key={day.dateKey}>{daySummary(day)}</li>
        ))}
      </ul>
      <div aria-hidden className="flex items-end gap-1.5 sm:gap-2">
        {days.map((day) => {
          const isToday = day.dateKey === todayKey
          const barHeight =
            day.totalMs > 0 && maxMs > 0
              ? Math.max(MIN_BAR_HEIGHT_PX, Math.round((day.totalMs / maxMs) * CHART_MAX_BAR_HEIGHT_PX))
              : 0
          return (
            <div key={day.dateKey} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-end" style={{ height: CHART_MAX_BAR_HEIGHT_PX }}>
                {barHeight > 0 ? (
                  <div
                    className="flex w-full flex-col-reverse overflow-hidden rounded-md"
                    style={{ height: barHeight }}
                  >
                    {TIME_DIRECTIONS.map((direction) => {
                      const ms = day.byDirection[direction.value]
                      if (ms === 0) return null
                      return (
                        <div
                          key={direction.value}
                          className={direction.dotClass}
                          style={{ height: `${(ms / day.totalMs) * 100}%` }}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-0.5 w-full rounded-full bg-hero-foreground/15" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isToday ? "font-bold text-hero-foreground" : "text-hero-muted",
                )}
              >
                {barLabel(day.dateKey, days.length)}
              </span>
              <span
                className={cn("h-1 w-4 rounded-full", isToday ? "bg-hero-foreground" : "bg-transparent")}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
