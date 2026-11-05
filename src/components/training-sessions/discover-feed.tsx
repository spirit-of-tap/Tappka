"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { DiscoverPage, DiscoverQuery } from "@/lib/training-sessions/discover"
import { DISCOVER_SEARCH_PARAMS } from "@/lib/training-sessions/discover-params"
import type { SessionTiming, SessionViewer, TrainingSessionListItem } from "@/lib/training-sessions/types"

import { SessionAgenda } from "./session-agenda"

/** Start fetching well before the sentinel is visible; the batch is small enough to stay unnoticed. */
const PREFETCH_MARGIN = "600px"

interface DiscoverFeedProps {
  initialSessions: TrainingSessionListItem[]
  /** Raw row offset of the next batch, or null when everything is loaded. */
  nextOffset: number | null
  query: DiscoverQuery
  viewer: SessionViewer
  commitments: SessionTiming[]
  now: string
  emptyTitle: string
  emptyDescription: string
}

/** Dedupe by id and restore chronological order (ascending upcoming, descending past). */
function orderSessions(
  sessions: TrainingSessionListItem[],
  isPast: boolean,
): TrainingSessionListItem[] {
  const byId = new Map(sessions.map((session) => [session.id, session]))
  return [...byId.values()].sort((a, b) =>
    isPast ? b.starts_at.localeCompare(a.starts_at) : a.starts_at.localeCompare(b.starts_at),
  )
}

/**
 * Objevovat's infinite feed. The first batch is server-rendered; further batches
 * are fetched and appended without touching the URL or re-rendering the page.
 */
export function DiscoverFeed({
  initialSessions,
  nextOffset: initialNextOffset,
  query,
  viewer,
  commitments,
  now,
  emptyTitle,
  emptyDescription,
}: DiscoverFeedProps) {
  const [sessions, setSessions] = useState(initialSessions)
  const [nextOffset, setNextOffset] = useState(initialNextOffset)
  const [isLoading, setIsLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingRef = useRef(false)
  const refreshingRef = useRef(false)
  /** Offsets already fetched, so a realtime refresh can reload every visible batch. */
  const loadedOffsetsRef = useRef<number[]>([0])
  const renderedAtRef = useRef(now)
  const isPast = query.filter === "probehle"

  const fetchPage = useCallback(
    async (offset: number): Promise<DiscoverPage | null> => {
      const params = new URLSearchParams({
        offset: String(offset),
        [DISCOVER_SEARCH_PARAMS.filter]: query.filter,
      })
      if (query.year !== null) params.set(DISCOVER_SEARCH_PARAMS.year, String(query.year))
      if (query.q) params.set(DISCOVER_SEARCH_PARAMS.query, query.q)

      const response = await fetch(`/api/training-sessions?${params.toString()}`)
      if (!response.ok) return null
      return (await response.json()) as DiscoverPage
    },
    [query.filter, query.q, query.year],
  )

  const loadMore = useCallback(async () => {
    if (loadingRef.current || nextOffset === null) return
    loadingRef.current = true
    setIsLoading(true)

    try {
      const page = await fetchPage(nextOffset)
      if (!page) {
        // Stop instead of retrying in a loop while the sentinel stays in view.
        setNextOffset(null)
        return
      }

      loadedOffsetsRef.current = [...loadedOffsetsRef.current, nextOffset]
      setSessions((current) => orderSessions([...current, ...page.sessions], isPast))
      setNextOffset(page.nextOffset)
    } catch {
      setNextOffset(null)
    } finally {
      loadingRef.current = false
      setIsLoading(false)
    }
  }, [fetchPage, isPast, nextOffset])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || nextOffset === null || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: PREFETCH_MARGIN },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, nextOffset])

  /**
   * `now` changes on every Server Component render (realtime refresh, mutations),
   * so reload the batches already on screen instead of collapsing back to page 1.
   */
  useEffect(() => {
    if (now === renderedAtRef.current) return
    renderedAtRef.current = now
    if (refreshingRef.current) return
    refreshingRef.current = true

    void (async () => {
      try {
        const pages = await Promise.all(loadedOffsetsRef.current.map(fetchPage))
        if (pages.some((page) => page === null)) return
        const lastPage = pages.at(-1)
        if (!lastPage) return

        setSessions(orderSessions(pages.flatMap((page) => page?.sessions ?? []), isPast))
        setNextOffset(lastPage.nextOffset)
      } catch {
        // Keep the batches already on screen if a refresh request fails.
      } finally {
        refreshingRef.current = false
      }
    })()
  }, [fetchPage, isPast, now])

  // Nothing to show and nothing left to fetch — render the regular empty state.
  const showEmpty = sessions.length === 0 && nextOffset === null

  return (
    <div className="space-y-6">
      {(sessions.length > 0 || showEmpty) && (
        <SessionAgenda
          sessions={sessions}
          viewer={viewer}
          commitments={commitments}
          now={now}
          showLocation={false}
          showPreparation={false}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
      )}

      {nextOffset !== null && <div ref={sentinelRef} className="h-px" aria-hidden />}

      {/* Invisible to sighted viewers, still announced to screen readers. */}
      <span className="sr-only" role="status">
        {isLoading ? "Načítám další TS…" : ""}
      </span>
    </div>
  )
}
