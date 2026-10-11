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
  { value: "training", label: "Training", dotClass: "bg-time-training" },
  { value: "reading", label: "Reading", dotClass: "bg-time-reading" },
  { value: "practise", label: "Practise", dotClass: "bg-time-practise" },
  { value: "project", label: "Projekt", dotClass: "bg-time-project" },
] as const

export const TIME_DIRECTION_LABELS: Record<TimeDirection, string> = {
  training: "Training",
  reading: "Reading",
  practise: "Practise",
  project: "Projekt",
}

/** Directions with fixed system tags (TS, Příprava na TS / Čtení, Esej): a tag is required. */
export const SYSTEM_TAG_DIRECTIONS: readonly TimeDirection[] = ["training", "reading"]
/** Directions whose tags the team creates and each person shows or hides. */
export const TEAM_TAG_DIRECTIONS: readonly TimeDirection[] = ["practise", "project"]

/** `time_tags.system_key` of the tag the Training Session attendance trigger assigns. */
export const TRAINING_SESSION_TAG_KEY = "training_session"

/** Pre-selected tag when an entry switches to Training / Reading (the most common one). */
export const DEFAULT_SYSTEM_TAG_KEYS: Partial<Record<TimeDirection, string>> = {
  training: TRAINING_SESSION_TAG_KEY,
  reading: "reading",
}

/** Where a person picks which team tags they see. */
export const TAG_SETTINGS_URL = "/settings/cas"

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
export const TIME_ENTRY_WITH_TAG_SELECT = "*, tag:time_tags!time_entries_tag_id_fkey(id, name, direction)"

/** Constraint / index names used to map DB errors to user-facing messages. */
export const DB_CONSTRAINTS = {
  oneRunningTimer: "time_entries_one_running_key",
  tagTeamDirectionName: "time_tags_team_direction_name_key",
  tagDirection: "time_entries_tag_direction_fkey",
  noOverlap: "time_entries_no_overlap",
} as const

export const TIME_TRACKING_MESSAGES = {
  unauthorized: "Neautorizováno",
  profileNotFound: "Profil nenalezen",
  featureUnavailable: "Modul není dostupný",
  invalidJson: "Neplatný požadavek",
  overlap: "Záznam se překrývá s jiným záznamem",
  timerAlreadyRunning: "Už ti běží časomíra",
  tagNameTaken: "Tag s tímto názvem už tým v tomhle směru má",
  tagRequired: "Vyber tag",
  tagNeedsTeam: "Tag můžeš založit, jen když jsi v týmu",
  systemTagDirection: "Tagy pro Training a Reading jsou pevně dané",
  tagDirectionMismatch: "Tag patří k jinému směru",
  invalidRange: "Neplatný časový rozsah",
  invalidTag: "Neplatný tag",
  forbidden: "Na tuhle akci nemáš oprávnění",
  entryNotFound: "Záznam nenalezen",
  tagNotFound: "Tag nenalezen",
  noRunningTimer: "Žádná časomíra neběží",
  generic: "Něco se nepovedlo, zkus to prosím znovu",
} as const
