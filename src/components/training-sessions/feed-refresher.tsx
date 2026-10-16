"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef } from "react"

import { useTrainingSessionFeed } from "@/lib/training-sessions/use-training-session-feed"

const REFRESH_DEBOUNCE_MS = 400

/** Re-renders the surrounding Server Component whenever the TS feed reports a change. */
export function FeedRefresher() {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS)
  }, [router])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  useTrainingSessionFeed(refresh)
  return null
}
