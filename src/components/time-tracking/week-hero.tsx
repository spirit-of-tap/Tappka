import { Check, Play, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ProgressRing } from "@/components/ui/progress-ring"
import { formatMetricValue } from "@/lib/metrics/config"
import { TIME_DIRECTION_LABELS } from "@/lib/time-tracking/constants"
import { type DayBreakdown, remainingHours, topDirection } from "@/lib/time-tracking/day-breakdown"
import { formatDurationHms } from "@/lib/time-tracking/duration"
import type { TimeDirection } from "@/lib/time-tracking/types"
import { cn } from "@/lib/utils"

import { DayChart } from "./day-chart"

export const START_TIMER_LABEL = "Spustit stopky"
export const STOP_TIMER_LABEL = "Zastavit"
export const GOAL_MET_LABEL = "Cíl splněn"

interface WeekHeroProps {
  /** Hours tracked in the period. */
  current: number
  /** Hours target scaled to the period. */
  target: number
  /** Name of the period, also the accessible name of the ring. */
  label: string
  /** Dates of the period, shown next to the label when it is a named preset. */
  rangeLabel?: string
  byDirection: Record<TimeDirection, number>
  /** Per-day buckets for the chart; `null` hides it (long ranges). */
  days: DayBreakdown[] | null
  todayKey: string
  /** Elapsed ms of the running timer, `null` when none runs. */
  timerElapsedMs: number | null
  timerPending?: boolean
  /** Without the handlers (no timer provider) the timer action is hidden. */
  onStartTimer?: () => void
  onStopTimer?: () => void
  className?: string
}

/** Hours tracked against the period target: ring, what is left, the top direction, the timer and a per-day chart. */
export function WeekHero({
  current,
  target,
  label,
  rangeLabel,
  byDirection,
  days,
  todayKey,
  timerElapsedMs,
  timerPending = false,
  onStartTimer,
  onStopTimer,
  className,
}: WeekHeroProps) {
  const passed = target > 0 && current >= target
  const fill = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0
  const remaining = remainingHours(current, target)
  const surplus = current - target
  const top = current > 0 ? topDirection(byDirection) : null
  const timerRunning = timerElapsedMs !== null

  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-3xl bg-hero p-5 text-hero-foreground motion-safe:animate-rise md:p-6 lg:flex-row lg:items-center lg:gap-8",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-5 md:gap-6">
        <ProgressRing
          percent={fill}
          strokeClassName={passed ? "stroke-hero-success" : "stroke-hero-foreground"}
          trackClassName="stroke-hero-foreground/15"
          className="md:size-28"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={current}
          aria-valuetext={`${formatMetricValue(current, "hours")} z ${formatMetricValue(target, "hours")}`}
        >
          <text
            x="48"
            y="49"
            textAnchor="middle"
            className="fill-hero-foreground font-heading text-[17px] font-extrabold"
          >
            {formatMetricValue(current, "hours")}
          </text>
          <text x="48" y="63" textAnchor="middle" className="fill-hero-muted text-xs">
            z {formatMetricValue(target, "hours")}
          </text>
        </ProgressRing>
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-hero-muted">
            {rangeLabel ? `${label} · ${rangeLabel}` : label}
          </p>
          {passed ? (
            <p className="flex flex-wrap items-center gap-x-2 font-heading text-2xl font-extrabold leading-tight text-hero-success sm:text-3xl">
              <Check className="size-6 stroke-[3]" aria-hidden />
              {GOAL_MET_LABEL}
              {surplus > 0 && (
                <span className="text-sm font-semibold tabular-nums text-hero-muted">
                  +{formatMetricValue(surplus, "hours")}
                </span>
              )}
            </p>
          ) : (
            <p className="font-heading text-2xl font-extrabold tabular-nums leading-tight sm:text-3xl">
              Zbývá {formatMetricValue(remaining, "hours")}
            </p>
          )}
          {top && <p className="text-sm text-hero-muted">Nejvíc dáváš do směru {TIME_DIRECTION_LABELS[top]}.</p>}
          {(onStartTimer || onStopTimer) && (
            <div className="flex flex-wrap items-center gap-3 pt-1.5">
              {timerRunning ? (
                <>
                  <span className="font-heading text-lg font-bold tabular-nums" role="timer" aria-label="Běžící časomíra">
                    {formatDurationHms(timerElapsedMs)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="focus-ring-hero"
                    onClick={onStopTimer}
                    disabled={timerPending}
                  >
                    <Square className="size-3.5 fill-current" aria-hidden />
                    {STOP_TIMER_LABEL}
                  </Button>
                </>
              ) : (
                <Button size="sm" className="focus-ring-hero" onClick={onStartTimer} disabled={timerPending}>
                  <Play className="size-3.5 fill-current" aria-hidden />
                  {START_TIMER_LABEL}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      {days && <DayChart days={days} todayKey={todayKey} className="w-full lg:w-80 xl:w-96" />}
    </section>
  )
}
