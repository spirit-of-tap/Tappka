"use client"

import Link from "next/link"
import { Play, Square } from "lucide-react"

import { TIME_DIRECTIONS, TIME_DIRECTION_LABELS } from "@/lib/time-tracking/constants"
import { formatDurationHms } from "@/lib/time-tracking/duration"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { useTimer } from "./timer-provider"

export const TIME_TRACKING_URL = "/cas"
const START_LABEL = "Spustit časomíru"
const STOP_LABEL = "Zastavit časomíru"

interface TimerWidgetProps {
  /** Icon-only rendering for the collapsed (icon) sidebar. */
  collapsed?: boolean
  className?: string
}

/** Sidebar timer: start button when idle, live elapsed time + stop when running. */
export function TimerWidget({ collapsed = false, className }: TimerWidgetProps) {
  const { active, elapsedMs, isPending, openStartSheet, openStopSheet } = useTimer()
  const elapsed = formatDurationHms(elapsedMs)

  if (collapsed) {
    const label = active ? `${STOP_LABEL} (${elapsed})` : START_LABEL
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant={active ? "destructive" : "default"}
            aria-label={active ? STOP_LABEL : START_LABEL}
            disabled={isPending}
            onClick={active ? openStopSheet : openStartSheet}
            className={className}
          >
            {active ? <Square aria-hidden /> : <Play aria-hidden />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  if (!active) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={openStartSheet}
        className={cn("w-full justify-start", className)}
      >
        <Play aria-hidden className="text-primary" />
        {START_LABEL}
      </Button>
    )
  }

  const direction = TIME_DIRECTIONS.find((option) => option.value === active.direction)
  const heading = active.title ?? TIME_DIRECTION_LABELS[active.direction]

  return (
    <section aria-label="Běžící časomíra" className={cn("flex flex-col gap-2 rounded-lg border bg-card p-3", className)}>
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", direction?.dotClass)} />
        <span className="truncate font-medium" title={heading}>
          {heading}
        </span>
      </div>
      {(active.title !== null || active.tag !== null) && (
        <p className="truncate text-xs text-muted-foreground">
          {[active.title !== null ? TIME_DIRECTION_LABELS[active.direction] : null, active.tag?.name]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <p role="timer" aria-label="Uplynulý čas" className="font-heading text-2xl font-bold tabular-nums">
        {elapsed}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={openStopSheet}
          aria-label={STOP_LABEL}
        >
          <Square aria-hidden />
          Zastavit
        </Button>
        <Button asChild size="sm" variant="ghost" className="ml-auto">
          <Link href={TIME_TRACKING_URL}>Otevřít Čas</Link>
        </Button>
      </div>
    </section>
  )
}
