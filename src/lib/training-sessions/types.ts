import type { Tables } from "@/lib/supabase/tables"

export type TrainingSession = Tables<"training_sessions">
export type TrainingSessionPreparation = Tables<"training_session_preparations">
export type TrainingSessionReflection = Tables<"training_session_reflections">
export type TrainingSessionAttendee = Tables<"training_session_attendees">
export type TeamRow = Tables<"teams">
export type RoomRow = Tables<"rooms">
export type ProfileRow = Tables<"profiles">

export type TsStatus = "upcoming" | "ongoing" | "past" | "cancelled"

/** Minimal timing shape used by pure helpers (status, conflicts, grouping). */
export interface SessionTiming {
  id: string
  startsAt: string
  endsAt: string
  cancelledAt: string | null
}

/** The signed-in person looking at TS lists; drives "my team" and "joined" state. */
export interface SessionViewer {
  profileId: string
  teamId: string | null
}

export interface TsPersonSummary {
  id: string
  name: string | null
  picture: string | null
}

export interface TrainingSessionListItem
  extends Pick<
    TrainingSession,
    "id" | "team_id" | "topic" | "description" | "starts_at" | "ends_at" | "room_id" | "location_note" | "guest_capacity" | "cancelled_at"
  > {
  team: Pick<TeamRow, "id" | "name" | "color" | "onboardingYear"> | null
  room: Pick<RoomRow, "id" | "code" | "name"> | null
  facilitators: { profile: TsPersonSummary | null }[]
  guests: { profile_id: string; joined_at: string; profile: TsPersonSummary | null }[]
  preparation: Pick<TrainingSessionPreparation, "published_at"> | null
}

export interface TrainingSessionDetail extends TrainingSessionListItem {
  preparation: Pick<TrainingSessionPreparation, "published_at" | "content_json" | "updated_at"> | null
}

export const SESSION_LIST_SELECT =
  "id, team_id, topic, description, starts_at, ends_at, room_id, location_note, guest_capacity, cancelled_at, " +
  "team:teams!training_sessions_team_id_fkey(id, name, color, onboardingYear), " +
  "room:rooms!training_sessions_room_id_fkey(id, code, name), " +
  "facilitators:training_session_facilitators(profile:profiles!training_session_facilitators_profile_id_fkey(id, name, picture)), " +
  "guests:training_session_guests(profile_id, joined_at, profile:profiles!training_session_guests_profile_id_fkey(id, name, picture)), " +
  "preparation:training_session_preparations(published_at)"

export const SESSION_DETAIL_SELECT = SESSION_LIST_SELECT.replace(
  "preparation:training_session_preparations(published_at)",
  "preparation:training_session_preparations(published_at, content_json, updated_at)",
)

export function toTiming(session: Pick<TrainingSession, "id" | "starts_at" | "ends_at" | "cancelled_at">): SessionTiming {
  return { id: session.id, startsAt: session.starts_at, endsAt: session.ends_at, cancelledAt: session.cancelled_at }
}
