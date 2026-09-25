import { formatMetricValue } from "@/lib/metrics/config"
import { MS_PER_HOUR, TIME_DIRECTIONS } from "@/lib/time-tracking/constants"
import type { TimeDirection } from "@/lib/time-tracking/types"
import { cn } from "@/lib/utils"

interface DirectionSummaryProps {
  byDirection: Record<TimeDirection, number>
  className?: string
}

/** Training · Reading · Practise hours for the week — an overview, not a metric. */
export function DirectionSummary({ byDirection, className }: DirectionSummaryProps) {
  return (
    <dl className={cn("grid grid-cols-3 gap-2", className)}>
      {TIME_DIRECTIONS.map((direction) => (
        <div key={direction.value} className="rounded-lg border bg-card px-3 py-2">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", direction.dotClass)} />
            {direction.label}
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums" data-testid={`direction-total-${direction.value}`}>
            {formatMetricValue(byDirection[direction.value] / MS_PER_HOUR, "hours")}
          </dd>
        </div>
      ))}
    </dl>
  )
}
