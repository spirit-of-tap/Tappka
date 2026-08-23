import type { Tables } from "@/lib/supabase/tables"
import type { Profile } from "@/lib/auth-helpers"

export type AttendanceStatus = "present" | "absent" | "excused" | "late"

export interface TeamMemberProfile {
  id: string
  name: string | null
  picture: string | null
  role: string
}

export interface ActivityAttendee {
  id?: string
  activity_id?: string
  profile_id: string
  status: AttendanceStatus
  profile?: TeamMemberProfile | null
}

export type TeamActivity = Tables<"team_activities">

export interface TeamActivityWithCreator extends TeamActivity {
  created_by: Pick<Profile, "id" | "name" | "picture"> | null
  updated_by: Pick<Profile, "id" | "name" | "picture"> | null
  attendees?: ActivityAttendee[]
}

export const ACTIVITY_WITH_CREATOR_SELECT =
  "*, created_by:profiles!created_by_profile_id(id, name, picture), updated_by:profiles!updated_by_profile_id(id, name, picture), attendees:team_activity_attendees(id, activity_id, profile_id, status, profile:profiles!team_activity_attendees_profile_id_fkey(id, name, picture, role))"

export const EDITABLE_ACTIVITY_FIELDS = [
  "occurred_at",
  "activity_type",
  "participants",
  "reason",
  "reflection",
] as const

export type EditableActivityField = (typeof EDITABLE_ACTIVITY_FIELDS)[number]

