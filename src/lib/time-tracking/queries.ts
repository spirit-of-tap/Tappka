import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

import { TIME_ENTRY_WITH_TAG_SELECT } from "./constants"
import { computeDurationMs } from "./duration"
import { listNewTeamTags } from "./tag-catalog"
import type { TagCatalog, TeamMember, TimeDirection, TimeEntryWithTag, TimeRange, TimeTag } from "./types"

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

/** PostgREST caps responses at `max_rows` (1000); longer ranges are fetched page by page. */
const LIST_PAGE_SIZE = 1000

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
 * Running timers are included. RLS limits what the caller can see. Long ranges (months,
 * a whole team for a year) exceed one PostgREST page, so pages are fetched until short.
 */
export async function listEntries(supabase: Client, params: ListEntriesParams): Promise<TimeEntryWithTag[]> {
  if (params.profileIds.length === 0) return []

  const fromIso = toIso(params.from)
  const toIsoValue = toIso(params.to)
  // Keyed by id: offset paging is not a snapshot, so a row pushed down by a timer started
  // between two page requests could otherwise appear (and be summed) twice.
  const byId = new Map<string, TimeEntryWithTag>()

  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    let query = supabase
      .from("time_entries")
      .select(TIME_ENTRY_WITH_TAG_SELECT)
      .in("profile_id", [...params.profileIds])
      .lt("started_at", toIsoValue)
      .or(`ended_at.is.null,ended_at.gt.${fromIso}`)

    if (params.direction !== undefined) query = query.eq("direction", params.direction)
    if (params.tagId !== undefined) query = query.eq("tag_id", params.tagId)

    // `id` breaks ties so pages never skip or repeat rows with equal `started_at`.
    const { data, error } = await query
      .order("started_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + LIST_PAGE_SIZE - 1)

    if (error) throw error
    const page = (data ?? []) as TimeEntryWithTag[]
    for (const entry of page) byId.set(entry.id, entry)
    if (page.length < LIST_PAGE_SIZE) return [...byId.values()]
  }
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
  range: TimeRange,
): Promise<{ members: TeamMember[]; entries: TimeEntryWithTag[] }> {
  const members = await listTeamMembers(supabase, teamId)
  const entries = await listEntries(supabase, {
    profileIds: members.map((member) => member.id),
    from: range.from,
    to: range.to,
  })
  return { members, entries }
}

/**
 * Tags usable by a member of `teamId`: system tags plus the team's tags, ordered by name.
 * Filtered explicitly because coaches and admins can read every team's tags (RLS).
 */
export async function listTags(supabase: Client, teamId: string | null): Promise<TimeTag[]> {
  let query = supabase.from("time_tags").select("*")
  query = teamId === null ? query.is("team_id", null) : query.or(`team_id.is.null,team_id.eq.${teamId}`)
  const { data, error } = await query.order("name", { ascending: true })

  if (error) throw error
  return data ?? []
}

/** Ids of the team tags the profile chose to see. */
export async function listSelectedTagIds(supabase: Client, profileId: string): Promise<string[]> {
  const { data, error } = await supabase.from("time_tag_selections").select("tag_id").eq("profile_id", profileId)

  if (error) throw error
  return (data ?? []).map((row) => row.tag_id)
}

/** When the profile last reviewed its tag settings, or `null`. */
export async function getTagsReviewedAt(supabase: Client, profileId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("time_tracking_preferences")
    .select("tags_reviewed_at")
    .eq("profile_id", profileId)
    .maybeSingle()

  if (error) throw error
  return data?.tags_reviewed_at ?? null
}

export interface TagCatalogWithReview extends TagCatalog {
  reviewedAt: string | null
}

/** Usable tags, the profile's shown team tags and how many new team tags await review. */
export async function getTagCatalog(
  supabase: Client,
  profile: { id: string; team_id: string | null },
): Promise<TagCatalogWithReview> {
  const [tags, selectedTagIds, reviewedAt] = await Promise.all([
    listTags(supabase, profile.team_id),
    listSelectedTagIds(supabase, profile.id),
    getTagsReviewedAt(supabase, profile.id),
  ])
  const newTags = listNewTeamTags({ tags, selectedTagIds: new Set(selectedTagIds), reviewedAt, profileId: profile.id })
  return { tags, selectedTagIds, newTagCount: newTags.length, reviewedAt }
}

/** True when `tagId` is a system tag or a tag of `teamId`. */
export async function isUsableTag(supabase: Client, teamId: string | null, tagId: string): Promise<boolean> {
  const { data, error } = await supabase.from("time_tags").select("team_id").eq("id", tagId).maybeSingle()

  if (error) throw error
  return data !== null && (data.team_id === null || data.team_id === teamId)
}

/** Shows (`selected`) or hides a team tag in the profile's tag picker; idempotent. */
export async function setTagSelected(
  supabase: Client,
  profileId: string,
  tagId: string,
  selected: boolean,
): Promise<void> {
  const { error } = selected
    ? await supabase
        .from("time_tag_selections")
        .upsert({ profile_id: profileId, tag_id: tagId }, { onConflict: "profile_id,tag_id", ignoreDuplicates: true })
    : await supabase.from("time_tag_selections").delete().eq("profile_id", profileId).eq("tag_id", tagId)

  if (error) throw error
}

/** Marks every team tag existing at `now` as reviewed (no longer announced as new). */
export async function markTagsReviewed(supabase: Client, profileId: string, now: Date = new Date()): Promise<string> {
  const reviewedAt = now.toISOString()
  const { error } = await supabase
    .from("time_tracking_preferences")
    .upsert(
      { profile_id: profileId, tags_reviewed_at: reviewedAt, updated_at: reviewedAt },
      { onConflict: "profile_id" },
    )

  if (error) throw error
  return reviewedAt
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
