"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { MS_PER_SECOND, TIME_TRACKING_MESSAGES } from "@/lib/time-tracking/constants"
import type { TimeDirection, TimeEntryWithTag } from "@/lib/time-tracking/types"

const TIMER_ENDPOINT = "/api/time-entries/timer"
const TICK_INTERVAL_MS = MS_PER_SECOND

export interface StartTimerPayload {
  direction: TimeDirection
  tagId?: string | null
  title?: string | null
}

/** Which shared timer sheet is open (mounted once via `TimerSheets`). */
export type TimerSheet = "start" | "stop" | null

export interface TimerContextValue {
  /** Whether the current profile may use time tracking (feature flag). */
  canAccess: boolean
  /** The running entry, or `null` when no timer runs. */
  active: TimeEntryWithTag | null
  /** Elapsed ms of `active` (0 when idle); recomputed from `started_at` every second. */
  elapsedMs: number
  /** True while a start/stop request is in flight. */
  isPending: boolean
  /** Starts a timer. Resolves `true` on success; errors are toasted. */
  start: (payload: StartTimerPayload) => Promise<boolean>
  /** Stops the running timer. Resolves `true` on success; errors are toasted. */
  stop: () => Promise<boolean>
  /** Re-reads the running timer from the API (DB is the source of truth). */
  refresh: () => Promise<void>
  sheet: TimerSheet
  openStartSheet: () => void
  openStopSheet: () => void
  closeSheet: () => void
}

const TimerContext = React.createContext<TimerContextValue | null>(null)

interface TimerProviderProps {
  initialActive: TimeEntryWithTag | null
  canAccess: boolean
  /**
   * Server render time. Seeds the clock so the first client render matches the
   * server HTML (no hydration mismatch on the elapsed time).
   */
  serverNow?: number
  children: React.ReactNode
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === "string" && body.error !== "") return body.error
  } catch {
    // Non-JSON error body — fall through to the generic message.
  }
  return TIME_TRACKING_MESSAGES.generic
}

export function TimerProvider({ initialActive, canAccess, serverNow, children }: TimerProviderProps) {
  const router = useRouter()
  const [active, setActive] = React.useState<TimeEntryWithTag | null>(initialActive)
  const [isPending, setIsPending] = React.useState(false)
  const [sheet, setSheet] = React.useState<TimerSheet>(null)
  const [now, setNow] = React.useState<number>(() => serverNow ?? Date.now())

  // A server refresh (router.refresh) re-renders the layout with fresh data —
  // adopt it (adjusting state during render, not in an effect).
  const [prevInitialActive, setPrevInitialActive] = React.useState(initialActive)
  if (initialActive !== prevInitialActive) {
    setPrevInitialActive(initialActive)
    setActive(initialActive)
  }

  const activeId = active?.id ?? null
  React.useEffect(() => {
    if (activeId === null) return
    const tick = () => setNow(Date.now())
    // Sync immediately (the clock is stale while idle), then every second.
    const immediate = window.setTimeout(tick, 0)
    const interval = window.setInterval(tick, TICK_INTERVAL_MS)
    return () => {
      window.clearTimeout(immediate)
      window.clearInterval(interval)
    }
  }, [activeId])

  const elapsedMs = active ? Math.max(0, now - Date.parse(active.started_at)) : 0

  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch(TIMER_ENDPOINT, { cache: "no-store" })
      if (!response.ok) {
        toast.error(await readError(response))
        return
      }
      const body = (await response.json()) as { data: TimeEntryWithTag | null }
      setActive(body.data ?? null)
    } catch {
      toast.error(TIME_TRACKING_MESSAGES.generic)
    }
  }, [])

  const mutate = React.useCallback(
    async (payload: Record<string, unknown>): Promise<boolean> => {
      setIsPending(true)
      let ok = false
      try {
        const response = await fetch(TIMER_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        ok = response.ok
        if (!ok) toast.error(await readError(response))
      } catch {
        toast.error(TIME_TRACKING_MESSAGES.generic)
      }
      await refresh()
      setIsPending(false)
      // Server components (e.g. the /cas list) show entries too.
      if (ok) router.refresh()
      return ok
    },
    [refresh, router],
  )

  const start = React.useCallback(
    (payload: StartTimerPayload) =>
      mutate({
        action: "start",
        direction: payload.direction,
        tagId: payload.tagId ?? null,
        title: payload.title ?? null,
      }),
    [mutate],
  )

  const stop = React.useCallback(() => mutate({ action: "stop" }), [mutate])

  const openStartSheet = React.useCallback(() => setSheet("start"), [])
  const openStopSheet = React.useCallback(() => setSheet("stop"), [])
  const closeSheet = React.useCallback(() => setSheet(null), [])

  const value = React.useMemo<TimerContextValue>(
    () => ({
      canAccess,
      active,
      elapsedMs,
      isPending,
      start,
      stop,
      refresh,
      sheet,
      openStartSheet,
      openStopSheet,
      closeSheet,
    }),
    [canAccess, active, elapsedMs, isPending, start, stop, refresh, sheet, openStartSheet, openStopSheet, closeSheet],
  )

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

/** Timer state and actions. Throws outside `TimerProvider`. */
export function useTimer(): TimerContextValue {
  const context = React.useContext(TimerContext)
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider.")
  }
  return context
}

/** Like `useTimer`, but returns `null` outside `TimerProvider` (e.g. bare component tests). */
export function useOptionalTimer(): TimerContextValue | null {
  return React.useContext(TimerContext)
}
