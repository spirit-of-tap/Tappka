import { Check } from "lucide-react"

import { ProgressRing } from "@/components/ui/progress-ring"
import { formatMetricValue } from "@/lib/metrics/config"
import { cn } from "@/lib/utils"

interface WeekHeroProps {
  /** Hours tracked in the period. */
  current: number
  /** Hours target scaled to the period. */
  target: number
  label: string
  className?: string
}

/** Hours tracked against the period target as a ring with the remaining time. */
export function WeekHero({ current, target, label, className }: WeekHeroProps) {
  const passed = target > 0 && current >= target
  const fill = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0
  const remaining = Math.max(0, target - current)
  const surplus = current - target

  return (
    <section
      className={cn(
        "flex items-center gap-5 rounded-2xl border bg-card p-5 text-card-foreground shadow-sm motion-safe:animate-rise md:gap-6 md:p-6",
        className,
      )}
    >
      <ProgressRing
        percent={fill}
        strokeClassName={passed ? "stroke-success" : "stroke-primary"}
        className="md:size-28"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={current}
        aria-valuetext={`${formatMetricValue(current, "hours")} z ${formatMetricValue(target, "hours")}`}
      >
        <text x="48" y="54" textAnchor="middle" className="fill-foreground font-heading text-[22px] font-extrabold">
          {Math.round(fill)}&nbsp;%
        </text>
      </ProgressRing>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-bold text-primary">{label}</p>
        <p className="font-heading text-3xl font-extrabold tabular-nums leading-tight">
          {formatMetricValue(current, "hours")}
          <span className="ml-1.5 text-base font-medium text-muted-foreground">
            z {formatMetricValue(target, "hours")}
          </span>
        </p>
        {passed ? (
          <p className="flex items-center gap-1 text-sm font-semibold text-success-strong">
            <Check className="size-4 stroke-[2.5]" aria-hidden />
            Splněno{surplus > 0 ? ` (+${formatMetricValue(surplus, "hours")})` : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground tabular-nums">Zbývá {formatMetricValue(remaining, "hours")}</p>
        )}
      </div>
    </section>
  )
}
