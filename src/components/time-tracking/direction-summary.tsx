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
    <dl className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {TIME_DIRECTIONS.map((direction, index) => {
        const share = totalMs > 0 ? (byDirection[direction.value] / totalMs) * 100 : 0
        return (
          <div
            key={direction.value}
            style={{ animationDelay: `${index * 60}ms` }}
            className="space-y-2 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm motion-safe:animate-rise"
          >
            <dt className="flex items-center justify-between gap-2 text-sm font-medium">
              <span className="flex min-w-0 items-center gap-1.5">
                <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", direction.dotClass)} />
                <span className="truncate">{direction.label}</span>
              </span>
              <span className="text-xs tabular-nums text-muted-foreground" data-testid={`direction-share-${direction.value}`}>
                {Math.round(share)}&nbsp;%
              </span>
            </dt>
            <dd className="font-heading text-2xl font-bold tabular-nums" data-testid={`direction-total-${direction.value}`}>
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
