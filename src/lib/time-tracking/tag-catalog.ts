import { SYSTEM_TAG_DIRECTIONS, TEAM_TAG_DIRECTIONS } from "./constants"
import type { TimeDirection, TimeTag } from "./types"

/** Training and Reading entries must carry one of their fixed system tags. */
export function isTagRequired(direction: TimeDirection): boolean {
  return SYSTEM_TAG_DIRECTIONS.includes(direction)
}

/** Practise and Projekt use team tags (created by members, shown or hidden per person). */
export function hasTeamTags(direction: TimeDirection): boolean {
  return TEAM_TAG_DIRECTIONS.includes(direction)
}

export function isSystemTag(tag: Pick<TimeTag, "team_id">): boolean {
  return tag.team_id === null
}

/** Case- and whitespace-insensitive tag name, the same rule as the DB unique index. */
export function normalizeTagName(name: string): string {
  return name.trim().toLocaleLowerCase("cs")
}

export interface NewTagsParams {
  tags: readonly TimeTag[]
  selectedTagIds: ReadonlySet<string>
  /** `time_tracking_preferences.tags_reviewed_at`; `null` = never reviewed. */
  reviewedAt: string | null
  profileId: string
}

/**
 * Team tags announced as new: created by someone else after the last review and not yet
 * shown. A person who never reviewed sees every such team tag (e.g. right after joining).
 */
export function listNewTeamTags({ tags, selectedTagIds, reviewedAt, profileId }: NewTagsParams): TimeTag[] {
  const reviewedMs = reviewedAt === null ? null : Date.parse(reviewedAt)
  return tags.filter(
    (tag) =>
      !isSystemTag(tag) &&
      !selectedTagIds.has(tag.id) &&
      tag.created_by_profile_id !== profileId &&
      (reviewedMs === null || Date.parse(tag.created_at) > reviewedMs),
  )
}

export interface PickerTagsParams {
  tags: readonly TimeTag[]
  selectedTagIds: ReadonlySet<string>
  direction: TimeDirection
  /** The entry's current tag stays listed even when hidden, so editing never loses it. */
  currentTagId?: string | null
}

/** Tags offered in the picker for a direction: system tags, or the shown team tags. */
export function pickerTags({ tags, selectedTagIds, direction, currentTagId = null }: PickerTagsParams): TimeTag[] {
  return tags.filter(
    (tag) =>
      tag.direction === direction &&
      (isSystemTag(tag) || selectedTagIds.has(tag.id) || tag.id === currentTagId),
  )
}

/** A team tag of the direction with the same name, shown or not (to avoid duplicates). */
export function findTeamTagByName(
  tags: readonly TimeTag[],
  direction: TimeDirection,
  name: string,
): TimeTag | undefined {
  const normalized = normalizeTagName(name)
  return tags.find(
    (tag) => !isSystemTag(tag) && tag.direction === direction && normalizeTagName(tag.name) === normalized,
  )
}
