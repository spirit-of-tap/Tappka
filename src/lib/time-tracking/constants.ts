import { Constants } from "@/lib/supabase/database.types"

import type { TimeDirection } from "./types"

export const PRAGUE_TIME_ZONE = "Europe/Prague"

export const MS_PER_SECOND = 1_000
export const MS_PER_MINUTE = 60 * MS_PER_SECOND
export const MS_PER_HOUR = 60 * MS_PER_MINUTE

/** DB enum values in declaration order. */
export const TIME_DIRECTION_VALUES = Constants.public.Enums.time_direction

export interface TimeDirectionOption {
  value: TimeDirection
  label: string
  /** Semantic token class for the direction dot / accent. */
  dotClass: string
}

export const TIME_DIRECTIONS: readonly TimeDirectionOption[] = [
  { value: "training", label: "Training", dotClass: "bg-chart-1" },
  { value: "reading", label: "Reading", dotClass: "bg-chart-2" },
  { value: "practise", label: "Practise", dotClass: "bg-chart-3" },
] as const

export const TIME_DIRECTION_LABELS: Record<TimeDirection, string> = {
  training: "Training",
  reading: "Reading",
  practise: "Practise",
}

export const WEEKLY_TARGET_HOURS = 40
export const WEEKLY_TARGET_MS = WEEKLY_TARGET_HOURS * MS_PER_HOUR

export const LONG_TIMER_WARN_MS = 6 * MS_PER_HOUR
export const LONG_TIMER_ALERT_MS = 12 * MS_PER_HOUR

export const TITLE_PLACEHOLDER = "Prodávání párků před ČZU"
export const TITLE_MAX_LENGTH = 120

export const TAG_NAME_MIN_LENGTH = 1
export const TAG_NAME_MAX_LENGTH = 40

/** Title used by the attendance trigger for automatic Training Session entries. */
export const ATTENDANCE_ENTRY_TITLE = "Training Session"

/** Select fragment that embeds the tag so callers get `TimeEntryWithTag` back. */
export const TIME_ENTRY_WITH_TAG_SELECT = "*, tag:time_tags(id, name)"

/** Constraint / index names used to map DB errors to user-facing messages. */
export const DB_CONSTRAINTS = {
  oneRunningTimer: "time_entries_one_running_key",
  tagProfileName: "time_tags_profile_name_key",
  noOverlap: "time_entries_no_overlap",
} as const

export const TIME_TRACKING_MESSAGES = {
  unauthorized: "Neautorizováno",
  profileNotFound: "Profil nenalezen",
  featureUnavailable: "Modul není dostupný",
  invalidJson: "Neplatný požadavek",
  overlap: "Záznam se překrývá s jiným záznamem",
  timerAlreadyRunning: "Už ti běží časomíra",
  tagNameTaken: "Tag s tímto názvem už máš",
  invalidRange: "Neplatný časový rozsah",
  invalidTag: "Neplatný tag",
  forbidden: "Na tuhle akci nemáš oprávnění",
  entryNotFound: "Záznam nenalezen",
  tagNotFound: "Tag nenalezen",
  noRunningTimer: "Žádná časomíra neběží",
  generic: "Něco se nepovedlo, zkus to prosím znovu",
} as const
