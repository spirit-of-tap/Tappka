import type { SupabaseClient } from "@supabase/supabase-js"

import { getCurrentSemesterRange } from "@/lib/metrics/periods"
import type { Database } from "@/lib/supabase/database.types"
import type { TimeRange } from "@/lib/time-tracking/types"

import {
  summarizeAttendance,
  type AttendanceRecordInput,
  type AttendanceSessionInput,
  type AttendanceSummary,
} from "./attendance"
import type { BreakRange, ScheduleSource } from "./slots"
import type { StatsSession } from "./stats"
import {
  SESSION_DETAIL_SELECT,
  SESSION_LIST_SELECT,
  type SessionViewer,
  type TrainingSessionDetail,
  type TrainingSessionListItem,
} from "./types"

export interface ListSessionsFilter {
  from?: string
  to?: string
  teamId?: string
  ids?: string[]
  order?: "asc" | "desc"
  limit?: number
  /** Rows to skip; only used for id-less listing (cursor-style feeds). */
  offset?: number
}

const DEFAULT_LIST_LIMIT = 200
const ID_CHUNK_SIZE = 100
const TRAINING_SESSION_SCHEDULE_TYPE = "training_session"

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

function compareByStart(ascending: boolean) {
  return (x: TrainingSessionListItem, y: TrainingSessionListItem): number =>
    (x.starts_at < y.starts_at ? -1 : x.starts_at > y.starts_at ? 1 : 0) * (ascending ? 1 : -1)
}

export async function listSessions(
  supabase: SupabaseClient<Database>,
  filter: ListSessionsFilter,
): Promise<TrainingSessionListItem[]> {
  const ascending = (filter.order ?? "asc") === "asc"
  const limit = filter.limit ?? DEFAULT_LIST_LIMIT

  const run = async (ids?: string[]): Promise<TrainingSessionListItem[]> => {
    let query = supabase.from("training_sessions").select(SESSION_LIST_SELECT)
    if (filter.from) query = query.gte("ends_at", filter.from)
    if (filter.to) query = query.lt("ends_at", filter.to)
    if (filter.teamId) query = query.eq("team_id", filter.teamId)
    if (ids) query = query.in("id", ids)
    // Chunked id lookups already sort globally below, so offset belongs to the plain listing path.
    const offset = ids ? 0 : (filter.offset ?? 0)
    query = query.order("starts_at", { ascending }).range(offset, offset + limit - 1)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as unknown as TrainingSessionListItem[]
  }

  if (!filter.ids) return run()
  if (filter.ids.length === 0) return []
  const results = (await Promise.all(chunk(filter.ids, ID_CHUNK_SIZE).map((ids) => run(ids)))).flat()
  results.sort(compareByStart(ascending))
  return results.slice(0, limit)
}

/** Sessions the viewer takes part in: their own team's plus the ones they joined as a guest (cross). */
export async function listViewerSessions(
  supabase: SupabaseClient<Database>,
  viewer: SessionViewer,
  filter: Omit<ListSessionsFilter, "teamId" | "ids">,
): Promise<TrainingSessionListItem[]> {
  const { data, error } = await supabase
    .from("training_session_guests")
    .select("training_session_id")
    .eq("profile_id", viewer.profileId)
  if (error) throw error
  const joinedIds = (data ?? []).map((g) => g.training_session_id)

  const [teamSessions, joinedSessions] = await Promise.all([
    viewer.teamId ? listSessions(supabase, { ...filter, teamId: viewer.teamId }) : [],
    joinedIds.length > 0 ? listSessions(supabase, { ...filter, ids: joinedIds }) : [],
  ])
  const unique = new Map([...teamSessions, ...joinedSessions].map((s) => [s.id, s]))
  return [...unique.values()]
    .sort(compareByStart((filter.order ?? "asc") === "asc"))
    .slice(0, filter.limit ?? DEFAULT_LIST_LIMIT)
}

export async function getSessionDetail(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<TrainingSessionDetail | null> {
  const { data, error } = await supabase
    .from("training_sessions")
    .select(SESSION_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as TrainingSessionDetail | null
}

export async function getReflection(supabase: SupabaseClient<Database>, id: string) {
  const { data, error } = await supabase
    .from("training_session_reflections")
    .select(
      "content_json, updated_at, updated_by:profiles!training_session_reflections_updated_by_profile_id_fkey(id, name)",
    )
    .eq("training_session_id", id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listAttachments(supabase: SupabaseClient<Database>, id: string) {
  const { data, error } = await supabase
    .from("training_session_attachments")
    .select("id, label, file_name, file_size, content_type")
    .eq("training_session_id", id)
    .order("created_at", { ascending: true })
  if (error) throw error
  return data
}

export async function listAttendance(supabase: SupabaseClient<Database>, id: string) {
  const { data, error } = await supabase
    .from("training_session_attendees")
    .select("profile_id, status")
    .eq("training_session_id", id)
  if (error) throw error
  return data ?? []
}

/** The viewer's own-team TS attendance for the current academic semester. */
export async function getViewerAttendance(
  supabase: SupabaseClient<Database>,
  viewer: SessionViewer,
  now = new Date(),
): Promise<AttendanceSummary | null> {
  if (!viewer.teamId) return null

  const { start, end } = getCurrentSemesterRange(now)
  const { data: sessions, error } = await supabase
    .from("training_sessions")
    .select("id, starts_at, ends_at, cancelled_at")
    .eq("team_id", viewer.teamId)
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
  if (error) throw error

  const sessionInputs: AttendanceSessionInput[] = (sessions ?? []).map((session) => ({
    id: session.id,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    cancelledAt: session.cancelled_at,
  }))
  const sessionIds = sessionInputs.map((session) => session.id)

  let records: AttendanceRecordInput[] = []
  if (sessionIds.length > 0) {
    const { data, error: attendanceError } = await supabase
      .from("training_session_attendees")
      .select("training_session_id, status")
      .eq("profile_id", viewer.profileId)
      .in("training_session_id", sessionIds)
    if (attendanceError) throw attendanceError
    records = (data ?? []).map((record) => ({
      trainingSessionId: record.training_session_id,
      status: record.status,
    }))
  }

  return summarizeAttendance(sessionInputs, records, now)
}

export async function listTeamSlotSources(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<{ schedules: ScheduleSource[]; breaks: BreakRange[]; takenStarts: string[] }> {
  const [schedules, breaks, sessions] = await Promise.all([
    supabase
      .from("recurring_schedules")
      .select("day_of_week, start_time, end_time, valid_from, valid_until, room_id")
      .eq("team_id", teamId)
      .eq("schedule_type", TRAINING_SESSION_SCHEDULE_TYPE)
      .is("removed_at", null),
    supabase.from("schedule_breaks").select("start_date, end_date"),
    supabase
      .from("training_sessions")
      .select("starts_at")
      .eq("team_id", teamId)
      .gte("starts_at", new Date().toISOString()),
  ])
  if (schedules.error) throw schedules.error
  if (breaks.error) throw breaks.error
  if (sessions.error) throw sessions.error
  return {
    schedules: (schedules.data ?? []).map((s) => ({
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      validFrom: s.valid_from,
      validUntil: s.valid_until,
      roomId: s.room_id,
    })),
    breaks: (breaks.data ?? []).map((b) => ({ startDate: b.start_date, endDate: b.end_date })),
    takenStarts: (sessions.data ?? []).map((s) => s.starts_at),
  }
}

export async function listRooms(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from("rooms").select("id, code, name").is("removed_at", null).order("code")
  if (error) throw error
  return data ?? []
}

export async function searchSessionIds(supabase: SupabaseClient<Database>, q: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("search_training_sessions", { p_query: q })
  if (error) throw error
  return (data ?? []) as string[]
}

interface StatsSessionRow {
  id: string
  topic: string
  starts_at: string
  facilitators: { profile: { id: string; name: string | null } | null }[]
  preparation: { published_at: string | null } | null
}

const STATS_SESSION_SELECT =
  "id, topic, starts_at, " +
  "facilitators:training_session_facilitators(profile:profiles!training_session_facilitators_profile_id_fkey(id, name)), " +
  "preparation:training_session_preparations(published_at)"

/**
 * Non-cancelled sessions of a team starting inside `range`, shaped for `stats.ts`.
 * Attendance is only requested when the viewer may see it (team members, not coaches).
 */
export async function listStatsSessions(
  supabase: SupabaseClient<Database>,
  teamId: string,
  range: TimeRange,
  opts: { includeAttendance: boolean },
): Promise<StatsSession[]> {
  const { data, error } = await supabase
    .from("training_sessions")
    .select(STATS_SESSION_SELECT)
    .eq("team_id", teamId)
    .is("cancelled_at", null)
    .gte("starts_at", range.from.toISOString())
    .lt("starts_at", range.to.toISOString())
    .order("starts_at", { ascending: true })
    .returns<StatsSessionRow[]>()
  if (error) throw error
  const rows = data ?? []

  const attendanceBySession = new Map<string, StatsSession["attendance"]>()
  if (opts.includeAttendance && rows.length > 0) {
    const { data: attendance, error: attendanceError } = await supabase
      .from("training_session_attendees")
      .select("training_session_id, profile_id, status")
      .in(
        "training_session_id",
        rows.map((row) => row.id),
      )
    if (attendanceError) throw attendanceError
    for (const row of attendance ?? []) {
      // "absent" is never stored, but the enum allows it; such a row means the same as no row.
      if (row.status === "absent") continue
      const list = attendanceBySession.get(row.training_session_id) ?? []
      list.push({ profileId: row.profile_id, status: row.status })
      attendanceBySession.set(row.training_session_id, list)
    }
  }

  return rows.map((row) => ({
    id: row.id,
    topic: row.topic,
    startsAt: row.starts_at,
    facilitators: row.facilitators.flatMap((f) => (f.profile ? [{ id: f.profile.id, name: f.profile.name }] : [])),
    preparationPublishedAt: row.preparation?.published_at ?? null,
    attendance: attendanceBySession.get(row.id) ?? [],
  }))
}
