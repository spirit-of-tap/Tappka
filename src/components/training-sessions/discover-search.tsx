"use client"

import { Loader2, Search, X } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"

import { Input } from "@/components/ui/input"
import { DISCOVER_SEARCH_PARAMS } from "@/lib/training-sessions/discover-params"

/** Long enough to skip intermediate keystrokes, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Search-as-you-type for Objevovat. The URL stays the source of truth so the
 * result list can keep rendering on the server (filters, RLS, horizon).
 */
export function DiscoverSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get(DISCOVER_SEARCH_PARAMS.query) ?? ""
  const [value, setValue] = useState(urlQuery)
  const [syncedQuery, setSyncedQuery] = useState(urlQuery)
  const [isFocused, setIsFocused] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Adopt URL changes from back/forward or the filter chips, but never while
  // the viewer is typing — a late response must not clobber newer input.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery)
    if (!isFocused) setValue(urlQuery)
  }

  const cancelTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const commit = useCallback(
    (next: string) => {
      cancelTimer()
      const trimmed = next.trim()
      if (trimmed === urlQuery) return

      const params = new URLSearchParams(searchParams.toString())
      if (trimmed) params.set(DISCOVER_SEARCH_PARAMS.query, trimmed)
      else params.delete(DISCOVER_SEARCH_PARAMS.query)
      // Search spans every month, so a previously loaded horizon must not leak back in.
      params.delete(DISCOVER_SEARCH_PARAMS.windows)

      const qs = params.toString()
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
    },
    [cancelTimer, pathname, router, searchParams, urlQuery],
  )

  useEffect(() => cancelTimer, [cancelTimer])

  const handleChange = (next: string) => {
    setValue(next)
    cancelTimer()
    timerRef.current = setTimeout(() => commit(next), SEARCH_DEBOUNCE_MS)
  }

  const clear = () => {
    setValue("")
    commit("")
  }

  return (
    <div role="search" className="relative flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit(value)
          }
        }}
        placeholder="Hledat podle tématu nebo přípravy…"
        className="pl-9 pr-8"
        aria-label="Hledat TS"
        enterKeyHint="search"
      />
      {isPending ? (
        <Loader2
          className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-label="Hledám"
        />
      ) : value ? (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground focus-ring"
          aria-label="Vymazat hledání"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
