import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

import type { BreakRange, ScheduleSource } from "./slots"
import {
  SESSION_DETAIL_SELECT,
  SESSION_LIST_SELECT,
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
}

const DEFAULT_LIST_LIMIT = 200
const ID_CHUNK_SIZE = 100
const TRAINING_SESSION_SCHEDULE_TYPE = "training_session"

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
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
    const { data, error } = await query.order("starts_at", { ascending }).limit(limit)
    if (error) throw error
    return (data ?? []) as unknown as TrainingSessionListItem[]
  }

  if (!filter.ids) return run()
  if (filter.ids.length === 0) return []
  const results = (await Promise.all(chunk(filter.ids, ID_CHUNK_SIZE).map((ids) => run(ids)))).flat()
  results.sort((x, y) => (x.starts_at < y.starts_at ? -1 : x.starts_at > y.starts_at ? 1 : 0) * (ascending ? 1 : -1))
  return results.slice(0, limit)
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

export async function listAttendance(supabase: SupabaseClient<Database>, id: string) {
  const { data, error } = await supabase
    .from("training_session_attendees")
    .select("profile_id, status")
    .eq("training_session_id", id)
  if (error) throw error
  return data ?? []
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
