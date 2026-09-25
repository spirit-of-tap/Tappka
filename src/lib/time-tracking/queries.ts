import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

import { TIME_ENTRY_WITH_TAG_SELECT } from "./constants"
import { computeDurationMs } from "./duration"
import type { TeamMember, TimeDirection, TimeEntryWithTag, TimeRange, TimeTag } from "./types"

type Client = SupabaseClient<Database>

export interface ListEntriesParams {
  profileIds: readonly string[]
  /** Inclusive range start (entries ending after it are included). */
  from: Date | string
  /** Exclusive range end (entries starting before it are included). */
  to: Date | string
  direction?: TimeDirection
  tagId?: string
}

/** Smallest representable entry, used when `now` is not after a timer's start (clock skew). */
const MIN_TIMER_DURATION_MS = 1

/** Normalises to a `Z` ISO string so it is safe inside PostgREST `or()` filters. */
function toIso(value: Date | string): string {
  return (typeof value === "string" ? new Date(value) : value).toISOString()
}

/** The profile's running timer (row with `ended_at is null`), or `null`. */
export async function getActiveTimer(supabase: Client, profileId: string): Promise<TimeEntryWithTag | null> {
  const { data, error } = await supabase
    .from("time_entries")
    .select(TIME_ENTRY_WITH_TAG_SELECT)
    .eq("profile_id", profileId)
    .is("ended_at", null)
    .maybeSingle()

  if (error) throw error
  return (data as TimeEntryWithTag | null) ?? null
}

/** A single entry visible to the caller (RLS), or `null`. */
export async function getEntry(supabase: Client, entryId: string): Promise<TimeEntryWithTag | null> {
  const { data, error } = await supabase
    .from("time_entries")
    .select(TIME_ENTRY_WITH_TAG_SELECT)
    .eq("id", entryId)
    .maybeSingle()

  if (error) throw error
  return (data as TimeEntryWithTag | null) ?? null
}

/**
 * Entries of the given profiles intersecting `[from, to)`:
 * `started_at < to AND (ended_at IS NULL OR ended_at > from)`, newest first.
 * Running timers are included. RLS limits what the caller can see.
 */
export async function listEntries(supabase: Client, params: ListEntriesParams): Promise<TimeEntryWithTag[]> {
  if (params.profileIds.length === 0) return []

  const fromIso = toIso(params.from)
  let query = supabase
    .from("time_entries")
    .select(TIME_ENTRY_WITH_TAG_SELECT)
    .in("profile_id", [...params.profileIds])
    .lt("started_at", toIso(params.to))
    .or(`ended_at.is.null,ended_at.gt.${fromIso}`)

  if (params.direction !== undefined) query = query.eq("direction", params.direction)
  if (params.tagId !== undefined) query = query.eq("tag_id", params.tagId)

  const { data, error } = await query.order("started_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as TimeEntryWithTag[]
}

/** Active members of a team, ordered by name. */
export async function listTeamMembers(supabase: Client, teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, picture")
    .eq("team_id", teamId)
    .is("access_removed_at", null)
    .order("name", { ascending: true })

  if (error) throw error
  return (data ?? []).map((member) => ({ id: member.id, name: member.name ?? "", picture: member.picture }))
}

/** All entries of a team's active members intersecting the week (one query). */
export async function listTeamMemberEntries(
  supabase: Client,
  teamId: string,
  week: TimeRange,
): Promise<{ members: TeamMember[]; entries: TimeEntryWithTag[] }> {
  const members = await listTeamMembers(supabase, teamId)
  const entries = await listEntries(supabase, {
    profileIds: members.map((member) => member.id),
    from: week.from,
    to: week.to,
  })
  return { members, entries }
}

/** The profile's tags, ordered by name. */
export async function listTags(supabase: Client, profileId: string): Promise<TimeTag[]> {
  const { data, error } = await supabase
    .from("time_tags")
    .select("*")
    .eq("profile_id", profileId)
    .order("name", { ascending: true })

  if (error) throw error
  return data ?? []
}

/** True when `tagId` exists and belongs to `profileId`. */
export async function isOwnTag(supabase: Client, profileId: string, tagId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("time_tags")
    .select("id")
    .eq("id", tagId)
    .eq("profile_id", profileId)
    .maybeSingle()

  if (error) throw error
  return data !== null
}

/**
 * Stops the profile's running timer at `now` (no minimum length, always saved).
 * Returns the stopped entry, or `null` when nothing was running.
 */
export async function stopActiveTimer(
  supabase: Client,
  profileId: string,
  now: Date = new Date(),
): Promise<TimeEntryWithTag | null> {
  const active = await getActiveTimer(supabase, profileId)
  if (!active) return null

  const endedMs = Math.max(now.getTime(), Date.parse(active.started_at) + MIN_TIMER_DURATION_MS)
  const endedAt = new Date(endedMs).toISOString()
  const { data, error } = await supabase
    .from("time_entries")
    .update({
      ended_at: endedAt,
      duration_ms: computeDurationMs(active.started_at, endedAt),
      updated_by_profile_id: profileId,
    })
    .eq("id", active.id)
    .eq("profile_id", profileId)
    .is("ended_at", null)
    .select(TIME_ENTRY_WITH_TAG_SELECT)
    .maybeSingle()

  if (error) throw error
  return (data as TimeEntryWithTag | null) ?? null
}
