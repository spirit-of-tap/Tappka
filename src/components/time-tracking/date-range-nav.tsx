"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useOptimistic, useTransition } from "react"

import type { DateKeyRange } from "@/lib/time-tracking/date-range"

import { withRangeParams } from "./cas-query"
import { DateRangePicker } from "./date-range-picker"

export interface DateRangeNavProps {
  /** Displayed range, e.g. from `resolveRangeParams`. */
  range: DateKeyRange
  /** Prague „today" from the server render. */
  todayKey: string
  align?: "start" | "end"
  className?: string
}

/**
 * Period picker bound to the URL: writes `?from=&to=` via `router.replace`, keeping
 * every other query param (e.g. `?team=`, filters). The current week drops both params.
 */
export function DateRangeNav({ range, todayKey, align, className }: DateRangeNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  // Shows the requested range right away, so quick repeated ‹ › clicks keep stepping
  // from it instead of all computing the same target from the not-yet-updated prop.
  const [displayed, setDisplayed] = useOptimistic(range)

  function handleChange(next: DateKeyRange) {
    const query = withRangeParams(searchParams, next, todayKey).toString()
    startTransition(() => {
      setDisplayed(next)
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  return (
    <DateRangePicker
      value={displayed}
      onChange={handleChange}
      todayKey={todayKey}
      isPending={isPending}
      align={align}
      className={className}
    />
  )
}
