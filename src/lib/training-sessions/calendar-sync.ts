/**
 * Team Google Calendar sync for Training Sessions. Runs on the server with the
 * service-role client: it must work for any team (coach retries, background runs)
 * and is the only writer of `training_session_calendar_events`.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { after } from "next/server"

import { createGoogleCalendarClient, type GoogleCalendarClient } from "@/lib/google-calendar/client"
import { serverLogger } from "@/lib/server-logger"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/database.types"

import {
  buildTeamCalendarEvent,
  calendarEventId,
  describeCalendarError,
  SYNC_SESSION_COLUMNS,
  type SyncableSession,
} from "./calendar-sync-events"

/** Origin used in event links when neither `APP_URL` nor `SITE_URL` is configured. */
const FALLBACK_APP_URL = "https://tappka.cz"


export type SyncOutcome = "synced" | "removed" | "failed" | "skipped"

export interface SyncDeps {
  admin: SupabaseClient<Database>
  google: GoogleCalendarClient
  appOrigin: string
}

export interface TeamSyncResult {
  synced: number
  failed: number
}

export function appOrigin(): string {
  return process.env.APP_URL ?? process.env.SITE_URL ?? FALLBACK_APP_URL
}

/** Dependencies for this deployment, or `null` when the robot account is not configured. */
export function createSyncDeps(): SyncDeps | null {
  const google = createGoogleCalendarClient()
  return google ? { admin: createAdminClient(), google, appOrigin: appOrigin() } : null
}

interface LoadedSession {
  id: string
  team_id: string
  topic: string
  description: string | null
  starts_at: string
  ends_at: string
  location_note: string | null
  cancelled_at: string | null
  removed_at: string | null
  room: { code: string } | null
  team: { name: string } | null
  facilitators: { profile: { name: string | null } | null }[]
  /** One-to-one embed (PK = session id); normalised defensively in case PostgREST returns a list. */
  preparation: { published_at: string | null } | { published_at: string | null }[] | null
}

function toSyncable(session: LoadedSession): SyncableSession {
  const preparation = Array.isArray(session.preparation) ? session.preparation[0] : session.preparation
  return {
    ...session,
    facilitatorNames: session.facilitators.flatMap((f) => (f.profile?.name ? [f.profile.name] : [])),
    preparationPublished: Boolean(preparation?.published_at),
  }
}

async function recordState(
  deps: SyncDeps,
  session: { id: string; team_id: string },
  status: Exclude<SyncOutcome, "skipped">,
  errorMessage: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await deps.admin.from("training_session_calendar_events").upsert({
    training_session_id: session.id,
    team_id: session.team_id,
    status,
    error_message: errorMessage,
    attempted_at: now,
  })
  if (error) serverLogger.console.error("Failed to record calendar sync state:", error)
  if (status !== "failed") {
    await deps.admin.from("team_google_calendars").update({ last_synced_at: now }).eq("team_id", session.team_id)
  }
}

async function syncLoaded(deps: SyncDeps, calendarId: string, session: LoadedSession): Promise<SyncOutcome> {
  const eventId = calendarEventId(session.id)
  const shouldExist = session.cancelled_at === null && session.removed_at === null
  try {
    if (shouldExist) {
      await deps.google.upsertEvent(calendarId, eventId, buildTeamCalendarEvent(toSyncable(session), deps.appOrigin))
    } else {
      await deps.google.deleteEvent(calendarId, eventId)
    }
    const outcome = shouldExist ? "synced" : "removed"
    await recordState(deps, session, outcome, null)
    return outcome
  } catch (error) {
    serverLogger.console.error(`Calendar sync failed for training session ${session.id}:`, error)
    await recordState(deps, session, "failed", describeCalendarError(error))
    return "failed"
  }
}

async function loadCalendarId(deps: SyncDeps, teamId: string): Promise<string | null> {
  const { data } = await deps.admin.from("team_google_calendars").select("calendar_id").eq("team_id", teamId).maybeSingle()
  return data?.calendar_id ?? null
}

/** Pushes one session's current state to its team calendar; `skipped` when the team has none. */
export async function syncTrainingSession(deps: SyncDeps, sessionId: string): Promise<SyncOutcome> {
  const { data, error } = await deps.admin.from("training_sessions").select(SYNC_SESSION_COLUMNS).eq("id", sessionId).maybeSingle()
  if (error || !data) {
    if (error) serverLogger.console.error("Failed to load training session for calendar sync:", error)
    return "skipped"
  }
  const session = data as unknown as LoadedSession
  const calendarId = await loadCalendarId(deps, session.team_id)
  if (!calendarId) return "skipped"
  return syncLoaded(deps, calendarId, session)
}

/**
 * Bulk sync for one team. `upcoming`: every live session that has not ended yet
 * (used right after connecting). `failed`: only sessions whose last attempt failed.
 */
export async function syncTeamCalendar(deps: SyncDeps, teamId: string, mode: "upcoming" | "failed"): Promise<TeamSyncResult> {
  const calendarId = await loadCalendarId(deps, teamId)
  if (!calendarId) return { synced: 0, failed: 0 }

  let query = deps.admin.from("training_sessions").select(SYNC_SESSION_COLUMNS).eq("team_id", teamId)
  if (mode === "upcoming") {
    query = query.is("removed_at", null).is("cancelled_at", null).gte("ends_at", new Date().toISOString())
  } else {
    const { data: failedRows } = await deps.admin
      .from("training_session_calendar_events")
      .select("training_session_id")
      .eq("team_id", teamId)
      .eq("status", "failed")
    const ids = (failedRows ?? []).map((row) => row.training_session_id)
    if (ids.length === 0) return { synced: 0, failed: 0 }
    query = query.in("id", ids)
  }
  const { data, error } = await query.order("starts_at")
  if (error) {
    serverLogger.console.error("Failed to load team sessions for calendar sync:", error)
    return { synced: 0, failed: 0 }
  }

  const result: TeamSyncResult = { synced: 0, failed: 0 }
  // Sequential on purpose: a team has a handful of sessions and Google rate-limits bursts per calendar.
  for (const session of data as unknown as LoadedSession[]) {
    const outcome = await syncLoaded(deps, calendarId, session)
    if (outcome === "failed") result.failed += 1
    else result.synced += 1
  }
  return result
}

/** Fire-and-forget sync after a TS mutation; never delays or fails the user's request. */
export function scheduleSessionSync(sessionId: string): void {
  after(async () => {
    const deps = createSyncDeps()
    if (!deps) return
    try {
      await syncTrainingSession(deps, sessionId)
    } catch (error) {
      serverLogger.console.error("Background calendar sync crashed:", error)
    }
  })
}
