"use client"

import * as React from "react"
import { toast } from "sonner"

import { LONG_TIMER_ALERT_MS, LONG_TIMER_WARN_MS, MS_PER_HOUR } from "@/lib/time-tracking/constants"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog"

import { TIMER_STOPPED_MESSAGE } from "./stop-timer-sheet"
import { useOptionalTimer } from "./timer-provider"

const STORAGE_PREFIX = "tappka:time-tracking"
const WARN_HOURS = LONG_TIMER_WARN_MS / MS_PER_HOUR
const ALERT_HOURS = LONG_TIMER_ALERT_MS / MS_PER_HOUR
export const LONG_TIMER_WARN_MESSAGE = `Časomíra běží ${WARN_HOURS} hodin, pořád pracuješ?`

export function longTimerWarnKey(entryId: string): string {
  return `${STORAGE_PREFIX}:warned:${entryId}`
}

export function longTimerAckKey(entryId: string): string {
  return `${STORAGE_PREFIX}:alert-ack:${entryId}`
}

// In-memory mirror so a throwing/blocked sessionStorage never repeats the
// toast or dialog every tick.
const memoryFlags = new Set<string>()

function hasFlag(key: string): boolean {
  if (memoryFlags.has(key)) return true
  try {
    return window.sessionStorage.getItem(key) !== null
  } catch {
    return false
  }
}

function setFlag(key: string): void {
  memoryFlags.add(key)
  try {
    window.sessionStorage.setItem(key, "1")
  } catch {
    // Storage unavailable (private mode, blocked) — the memory flag suffices.
  }
}

/**
 * Nudges about forgotten timers: a toast at 6 h, a blocking dialog at 12 h.
 * Acknowledgements are kept per entry in `sessionStorage`. Mount once inside
 * `TimerProvider`.
 */
export function LongTimerAlert() {
  const timer = useOptionalTimer()
  const [ackedIds, setAckedIds] = React.useState<ReadonlySet<string>>(() => new Set())

  const active = timer?.active ?? null
  const elapsedMs = timer?.elapsedMs ?? 0
  const stop = timer?.stop
  const openStopSheet = timer?.openStopSheet
  const activeId = active?.id ?? null
  const reachedWarn = activeId !== null && elapsedMs >= LONG_TIMER_WARN_MS && elapsedMs < LONG_TIMER_ALERT_MS
  const reachedAlert = activeId !== null && elapsedMs >= LONG_TIMER_ALERT_MS

  React.useEffect(() => {
    if (!reachedWarn || activeId === null) return
    const key = longTimerWarnKey(activeId)
    if (hasFlag(key)) return
    setFlag(key)
    toast(LONG_TIMER_WARN_MESSAGE, {
      action: openStopSheet ? { label: "Zastavit", onClick: openStopSheet } : undefined,
    })
  }, [reachedWarn, activeId, openStopSheet])

  if (!timer?.canAccess || activeId === null) return null

  const open = reachedAlert && !ackedIds.has(activeId) && !hasFlag(longTimerAckKey(activeId))

  function acknowledge() {
    if (activeId === null) return
    setFlag(longTimerAckKey(activeId))
    setAckedIds((current) => new Set(current).add(activeId))
  }

  async function handleStop() {
    acknowledge()
    if (stop && (await stop())) toast.success(TIMER_STOPPED_MESSAGE)
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && acknowledge()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Časomíra běží už {ALERT_HOURS} hodin</AlertDialogTitle>
          <AlertDialogDescription>
            Pořád pracuješ? Pokud ne, zastav ji, ať záznam odpovídá skutečnosti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={acknowledge}>Pokračovat</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void handleStop()}>
            Zastavit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
