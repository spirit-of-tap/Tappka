import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

interface AttendanceTileProps {
  percent: number
  target: number
}

export function AttendanceTile({ percent, target }: AttendanceTileProps) {
  const met = percent >= target
  const fill = Math.min(100, Math.max(0, percent))

  return (
    <section
      aria-label="Tvoje docházka na TS"
      className={cn(
        "flex items-center gap-4 rounded-2xl border p-4 shadow-xs sm:gap-5 sm:p-5",
        met ? "border-transparent bg-success/12" : "bg-card",
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm font-medium text-muted-foreground">Tvoje docházka na TS · tento semestr</p>
          <p className="text-xs text-muted-foreground">cíl {target} %</p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={fill}
          aria-label="Docházka na TS"
          className="relative h-3 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700", met ? "bg-success" : "bg-primary")}
            style={{ width: `${fill}%` }}
          />
          <span aria-hidden className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${target}%` }} />
        </div>
      </div>
      <p
        className={cn(
          "flex shrink-0 items-center gap-1.5 font-heading text-3xl font-extrabold tabular-nums",
          met ? "text-success-strong" : "text-foreground",
        )}
      >
        {met && <Check className="size-6" aria-hidden />}
        {percent} %
      </p>
    </section>
  )
}
