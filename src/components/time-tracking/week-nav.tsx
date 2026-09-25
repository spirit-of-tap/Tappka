"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import type { TimeRange } from "@/lib/time-tracking/types"
import { getWeekRange, shiftWeekRange } from "@/lib/time-tracking/week"
import { cn } from "@/lib/utils"

import { WEEK_PARAM, formatWeekLabel, toWeekParam } from "./cas-query"

export interface WeekNavProps {
  /** Displayed week (`to` exclusive), e.g. from `resolveWeekParam`. */
  week: TimeRange
  /** Reference time from the server — decides what „Tento týden" is. */
  now: Date
  className?: string
}

/**
 * ‹ week label › with a „Tento týden" shortcut. Writes `?w=YYYY-MM-DD` via
 * `router.replace`, keeping every other query param (e.g. `?team=`).
 */
export function WeekNav({ week, now, className }: WeekNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentWeek = getWeekRange(now)
  const isCurrentWeek = week.from.getTime() === currentWeek.from.getTime()
  const isFutureOrCurrent = week.from.getTime() >= currentWeek.from.getTime()

  function goTo(target: TimeRange) {
    const params = new URLSearchParams(searchParams.toString())
    if (target.from.getTime() === currentWeek.from.getTime()) params.delete(WEEK_PARAM)
    else params.set(WEEK_PARAM, toWeekParam(target))
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  return (
    <div className={cn("flex items-center gap-1", className)} aria-busy={isPending || undefined}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Předchozí týden"
        onClick={() => goTo(shiftWeekRange(week, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span
        aria-live="polite"
        className={cn(
          "min-w-0 px-1 text-center text-sm font-medium tabular-nums transition-opacity",
          isPending && "opacity-60",
        )}
      >
        {formatWeekLabel(week)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Další týden"
        disabled={isFutureOrCurrent}
        onClick={() => goTo(shiftWeekRange(week, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
      {!isCurrentWeek && (
        <Button variant="outline" size="sm" className="ml-1" onClick={() => goTo(currentWeek)}>
          Tento týden
        </Button>
      )}
    </div>
  )
}
