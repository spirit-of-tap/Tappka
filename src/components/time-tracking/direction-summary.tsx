import { formatMetricValue } from "@/lib/metrics/config"
import { MS_PER_HOUR, TIME_DIRECTIONS } from "@/lib/time-tracking/constants"
import type { TimeDirection } from "@/lib/time-tracking/types"
import { cn } from "@/lib/utils"

interface DirectionSummaryProps {
  byDirection: Record<TimeDirection, number>
  className?: string
}

/** Training · Reading · Practise · Projekt hours for the period, with each one's share of the total. */
export function DirectionSummary({ byDirection, className }: DirectionSummaryProps) {
  const totalMs = TIME_DIRECTIONS.reduce((sum, direction) => sum + byDirection[direction.value], 0)

  return (
    <dl className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {TIME_DIRECTIONS.map((direction, index) => {
        const share = totalMs > 0 ? (byDirection[direction.value] / totalMs) * 100 : 0
        return (
          <div
            key={direction.value}
            style={{ animationDelay: `${index * 60}ms` }}
            className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm motion-safe:animate-rise"
          >
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", direction.dotClass)} />
              {direction.label}
            </dt>
            <dd className="font-heading text-xl font-bold tabular-nums" data-testid={`direction-total-${direction.value}`}>
              {formatMetricValue(byDirection[direction.value] / MS_PER_HOUR, "hours")}
            </dd>
            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700", direction.dotClass)}
                style={{ width: `${share}%` }}
              />
            </div>
          </div>
        )
      })}
    </dl>
  )
}
