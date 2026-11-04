"use client"

import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"

interface DiscoverLoadMoreProps {
  /** Next horizon URL, or null when there is nothing left to load. */
  nextHref: string | null
  /**
   * Skip the intersection check — used while the current window is empty, so
   * the viewer never ends up on a dead end without a "load more" button.
   */
  autoLoad?: boolean
}

/**
 * Extends the Objevovat horizon as the sentinel scrolls into view. The server
 * re-renders with a wider window, so loaded sessions stay on screen and more
 * append at the bottom.
 */
export function DiscoverLoadMore({ nextHref, autoLoad = false }: DiscoverLoadMoreProps) {
  const router = useRouter()
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const requestedRef = useRef<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadedHref, setLoadedHref] = useState(nextHref)
  const [isPending, startTransition] = useTransition()

  // A new horizon arrived — the previous page is on screen again.
  if (nextHref !== loadedHref) {
    setLoadedHref(nextHref)
    setIsLoading(false)
  }

  const load = useCallback(() => {
    if (!nextHref || requestedRef.current === nextHref) return
    requestedRef.current = nextHref
    setIsLoading(true)
    startTransition(() => router.replace(nextHref, { scroll: false }))
  }, [nextHref, router])

  useEffect(() => {
    if (!nextHref || isLoading) return
    if (autoLoad) {
      // Deferred so the sentinel paints a spinner before the navigation starts.
      const timeout = setTimeout(load, 0)
      return () => clearTimeout(timeout)
    }

    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) load()
      },
      { rootMargin: "400px" },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [autoLoad, isLoading, load, nextHref])

  if (!nextHref) return null

  const showLoader = isLoading || isPending

  return (
    <div ref={sentinelRef} className="flex min-h-10 items-center justify-center py-4">
      {showLoader && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Načítám další TS…
        </div>
      )}
    </div>
  )
}
