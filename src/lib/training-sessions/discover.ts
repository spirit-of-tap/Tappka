import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

import {
  TS_DISCOVER_PAGE_SIZE,
  TS_DISCOVER_SEARCH_LIMIT,
  type TsDiscoverFilter,
} from "./constants"
import { listSessions, searchSessionIds } from "./queries"
import type { SessionViewer, TrainingSessionListItem } from "./types"

export interface DiscoverQuery {
  filter: TsDiscoverFilter
  year: number | null
  q: string
}

export interface DiscoverPage {
  sessions: TrainingSessionListItem[]
  /** Raw row offset of the next batch, or null when the feed is exhausted. */
  nextOffset: number | null
}

/** Upper bound on per-request scans so a filter that matches nothing cannot fan out forever. */
const MAX_SCAN_BATCHES = 4

/** Shared by the server-rendered first page and the scroll API so both apply identical rules. */
export function matchesDiscoverFilter(
  session: TrainingSessionListItem,
  filter: TsDiscoverFilter,
  year: number | null,
  viewer: SessionViewer,
): boolean {
  if (year !== null && session.team?.onboardingYear !== year) return false
  if (filter !== "volna-mista") return true
  return (
    !session.cancelled_at &&
    session.team_id !== viewer.teamId &&
    session.guests.length < session.guest_capacity
  )
}

/**
 * One batch of Objevovat results. Search resolves its id set first and pages
 * through the filtered matches; browsing pages raw rows so a filter that hides
 * a whole batch never stalls the scroll.
 */
export async function listDiscoverPage(
  supabase: SupabaseClient<Database>,
  viewer: SessionViewer,
  query: DiscoverQuery,
  options: { offset?: number; now?: string } = {},
): Promise<DiscoverPage> {
  const offset = Math.max(0, options.offset ?? 0)
  const now = options.now ?? new Date().toISOString()
  const isPast = query.filter === "probehle"
  const order = isPast ? ("desc" as const) : ("asc" as const)

  if (query.q) {
    const ids = await searchSessionIds(supabase, query.q)
    if (ids.length === 0) return { sessions: [], nextOffset: null }

    const found = await listSessions(supabase, {
      ...(isPast ? { to: now, order } : { from: now, order }),
      ids,
      limit: TS_DISCOVER_SEARCH_LIMIT,
    })
    const filtered = found.filter((session) => matchesDiscoverFilter(session, query.filter, query.year, viewer))
    const sessions = filtered.slice(offset, offset + TS_DISCOVER_PAGE_SIZE)
    const consumed = offset + sessions.length
    return { sessions, nextOffset: consumed < filtered.length ? consumed : null }
  }

  const sessions: TrainingSessionListItem[] = []
  let rawOffset = offset
  let exhausted = false

  // Filters run after the query, so keep scanning whole batches until this page
  // has something to show (or the list ends). Offsets always count raw rows.
  for (let batchIndex = 0; batchIndex < MAX_SCAN_BATCHES && sessions.length < TS_DISCOVER_PAGE_SIZE && !exhausted; batchIndex++) {
    const batch = await listSessions(supabase, {
      ...(isPast ? { to: now, order } : { from: now, order }),
      offset: rawOffset,
      limit: TS_DISCOVER_PAGE_SIZE,
    })
    rawOffset += batch.length
    exhausted = batch.length < TS_DISCOVER_PAGE_SIZE
    sessions.push(...batch.filter((session) => matchesDiscoverFilter(session, query.filter, query.year, viewer)))
  }

  return { sessions, nextOffset: exhausted ? null : rawOffset }
}
