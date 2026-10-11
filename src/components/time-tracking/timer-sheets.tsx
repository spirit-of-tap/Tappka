"use client"

import { StartTimerSheet } from "./start-timer-sheet"
import { StopTimerSheet } from "./stop-timer-sheet"
import { useOptionalTimer } from "./timer-provider"

/**
 * The shared start / stop sheets, mounted once inside `TimerProvider`. Entry
 * points (sidebar widget, mobile tab, Spotlight, `/cas`) open them through
 * `openStartSheet()` / `openStopSheet()` from `useTimer()`.
 */
export function TimerSheets() {
  const timer = useOptionalTimer()
  if (!timer?.canAccess) return null

  const { sheet, openStartSheet, openStopSheet, closeSheet } = timer

  return (
    <>
      <StartTimerSheet
        open={sheet === "start"}
        onOpenChange={(open) => (open ? openStartSheet() : closeSheet())}
      />
      <StopTimerSheet
        open={sheet === "stop"}
        onOpenChange={(open) => (open ? openStopSheet() : closeSheet())}
      />
    </>
  )
}
