import type { Database } from "@/lib/supabase/database.types"
import type { Tables } from "@/lib/supabase/tables"

export type TimeEntry = Tables<"time_entries">
export type TimeTag = Tables<"time_tags">
export type TimeDirection = Database["public"]["Enums"]["time_direction"]
export type TimeEntrySource = Database["public"]["Enums"]["time_entry_source"]

/** Minimal tag shape embedded into entries (see `TIME_ENTRY_WITH_TAG_SELECT`). */
export type TimeTagRef = Pick<TimeTag, "id" | "name" | "direction">

/** Tags a person can use plus which team tags they chose to see (`GET /api/time-tags`). */
export interface TagCatalog {
  /** System tags and all tags of the person's team, ordered by name. */
  tags: TimeTag[]
  /** Team tags the person shows in their tag picker. */
  selectedTagIds: string[]
  /** Team tags created by others since the person last reviewed their tag settings. */
  newTagCount: number
}

export interface TimeEntryWithTag extends TimeEntry {
  tag: TimeTagRef | null
}

/** Half-open instant range `[from, to)`. */
export interface TimeRange {
  from: Date
  to: Date
}

export interface TimeSummary {
  totalMs: number
  byDirection: Record<TimeDirection, number>
  /** Keyed by `tag_id`; untagged time is under `null`. */
  byTag: Map<string | null, number>
}

export interface DayGroup<T extends TimeEntry = TimeEntryWithTag> {
  /** Prague calendar day, `YYYY-MM-DD`. */
  dateKey: string
  entries: T[]
}

/** Part of an entry that falls into one Prague calendar day (display only). */
export interface DaySegment {
  dateKey: string
  start: Date
  end: Date
  durationMs: number
  continuesNextDay: boolean
  continuedFromPreviousDay: boolean
}

export interface TeamMember {
  id: string
  name: string
  picture: string | null
}
