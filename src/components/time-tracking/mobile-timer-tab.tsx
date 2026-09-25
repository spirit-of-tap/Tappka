"use client"

import { Play, Square } from "lucide-react"

import { formatDurationHms } from "@/lib/time-tracking/duration"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import { useTimer } from "./timer-provider"

/**
 * Center control of the mobile bottom bar. A button (not a link): idle opens
 * the start sheet, running shows the live time and opens the stop sheet.
 */
export function MobileTimerTab() {
  const { active, elapsedMs, openStartSheet, openStopSheet } = useTimer()
  const running = active !== null

  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={running ? "Zastavit časomíru" : "Spustit časomíru"}
      onClick={running ? openStopSheet : openStartSheet}
      className="h-auto flex-1 flex-col gap-0.5 rounded-none px-0 py-0 text-muted-foreground transition-transform hover:bg-transparent active:scale-[0.98] focus-ring"
    >
      <span
        aria-hidden
        className={cn(
          "flex size-9 items-center justify-center rounded-full",
          running ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {running ? <Square className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
      </span>
      <span className={cn("text-[11px] font-medium", running && "text-foreground tabular-nums")}>
        {running ? formatDurationHms(elapsedMs) : "Start"}
      </span>
    </Button>
  )
}
