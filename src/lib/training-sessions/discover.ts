import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  normalizeOnboardingYear,
  rocnikForSchoolYear,
  schoolYearStartYearFor,
} from "@/lib/tymova-reflexe/month-grid"

import {
  TS_DISCOVER_PAGE_SIZE,
  TS_DISCOVER_SEARCH_LIMIT,
  type TsDiscoverFilter,
} from "./constants"
import { listSessions, searchSessionIds, type ListSessionsFilter, type TeamWindow } from "./queries"
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

/** Length of a "YYYY-MM" month key. */
const MONTH_KEY_LENGTH = 7

/**
 * A school year starts in September of the ISO (UTC) month, the same boundary
 * `schoolYearStartYearFor` applies to `starts_at.slice(0, 7)`.
 */
const SCHOOL_YEAR_START_SUFFIX = "-09-01T00:00:00.000Z"

export interface TeamCohort {
  id: string
  onboardingYear: number | null
}

/**
 * Study year (ročník) the team was in when the session took place.
 *
 * `teams.onboardingYear` is stored as a 4-digit school-year start (e.g. 2024)
 * in production; older/test data may hold a relative 1–3 or be empty, which
 * `normalizeOnboardingYear` resolves against the current school year.
 */
export function sessionStudyYear(
  startsAt: string,
  onboardingYear: number | null | undefined,
  now: string,
): number | null {
  const currentStartYear = schoolYearStartYearFor(now.slice(0, MONTH_KEY_LENGTH))
  const sessionStartYear = schoolYearStartYearFor(startsAt.slice(0, MONTH_KEY_LENGTH))
  return rocnikForSchoolYear(
    normalizeOnboardingYear(onboardingYear, currentStartYear),
    sessionStartYear,
  )
}

/** Per team, the school year in which it was in `year`; the DB equivalent of the `sessionStudyYear` check. */
export function studyYearWindows(teams: TeamCohort[], year: number, now: string): TeamWindow[] {
  const currentStartYear = schoolYearStartYearFor(now.slice(0, MONTH_KEY_LENGTH))
  return teams.map((team) => {
    const schoolYear = normalizeOnboardingYear(team.onboardingYear, currentStartYear) + year - 1
    return {
      teamId: team.id,
      from: `${schoolYear}${SCHOOL_YEAR_START_SUFFIX}`,
      to: `${schoolYear + 1}${SCHOOL_YEAR_START_SUFFIX}`,
    }
  })
}

async function listTeamCohorts(supabase: SupabaseClient<Database>): Promise<TeamCohort[]> {
  const { data, error } = await supabase.from("teams").select("id, onboardingYear")
  if (error) throw error
  return data
}

/** Shared by the server-rendered first page and the scroll API so both apply identical rules. */
export function matchesDiscoverFilter(
  session: TrainingSessionListItem,
  filter: TsDiscoverFilter,
  year: number | null,
  viewer: SessionViewer,
  now: string,
): boolean {
  if (
    year !== null &&
    sessionStudyYear(session.starts_at, session.team?.onboardingYear, now) !== year
  ) {
    return false
  }
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

  const [ids, teams] = await Promise.all([
    query.q ? searchSessionIds(supabase, query.q) : undefined,
    query.year !== null ? listTeamCohorts(supabase) : undefined,
  ])
  if (ids?.length === 0) return { sessions: [], nextOffset: null }

  // Narrow in SQL so each batch is mostly matches; matchesDiscoverFilter still
  // runs afterwards for what the DB cannot express (a free guest spot).
  const dbFilter: ListSessionsFilter = {
    ...(isPast ? { to: now, order } : { from: now, order }),
    ...(query.filter === "volna-mista"
      ? { openToGuests: true, excludeTeamId: viewer.teamId ?? undefined }
      : {}),
    ...(teams && query.year !== null ? { teamWindows: studyYearWindows(teams, query.year, now) } : {}),
  }
  const matches = (session: TrainingSessionListItem) =>
    matchesDiscoverFilter(session, query.filter, query.year, viewer, now)

  if (ids) {
    const found = await listSessions(supabase, { ...dbFilter, ids, limit: TS_DISCOVER_SEARCH_LIMIT })
    const filtered = found.filter(matches)
    const sessions = filtered.slice(offset, offset + TS_DISCOVER_PAGE_SIZE)
    const consumed = offset + sessions.length
    return { sessions, nextOffset: consumed < filtered.length ? consumed : null }
  }

  const sessions: TrainingSessionListItem[] = []
  let rawOffset = offset
  let exhausted = false

  // Full sessions are dropped after the query, so keep scanning whole batches until
  // this page has something to show (or the list ends). Offsets always count raw rows.
  for (let batchIndex = 0; batchIndex < MAX_SCAN_BATCHES && sessions.length < TS_DISCOVER_PAGE_SIZE && !exhausted; batchIndex++) {
    const batch = await listSessions(supabase, { ...dbFilter, offset: rawOffset, limit: TS_DISCOVER_PAGE_SIZE })
    rawOffset += batch.length
    exhausted = batch.length < TS_DISCOVER_PAGE_SIZE
    sessions.push(...batch.filter(matches))
  }

  return { sessions, nextOffset: exhausted ? null : rawOffset }
}
