// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Google Calendar sync of Training Sessions: one shared team calendar per team,
// written by Tappka's robot (service) account.
import { pgTable, pgEnum, foreignKey, pgPolicy, uuid, text, timestamp, index, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

import { profiles } from "./profiles"
import { teams } from "./teams"
import { trainingSessions } from "./training-sessions"

const OWN_TEAM_IDS = sql`(SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`
const CAN_MANAGE_TEAM = sql`(team_id IN ${OWN_TEAM_IDS} OR is_coach_or_admin())`

export const teamGoogleCalendars = pgTable("team_google_calendars", {
	teamId: uuid("team_id").primaryKey().notNull(),
	calendarId: text("calendar_id").notNull(),
	calendarName: text("calendar_name").notNull(),
	connectedAt: timestamp("connected_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	connectedByProfileId: uuid("connected_by_profile_id"),
	lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	check("team_google_calendars_calendar_id_check", sql`char_length(calendar_id) >= 3 AND char_length(calendar_id) <= 320`),
	check("team_google_calendars_calendar_name_check", sql`char_length(calendar_name) <= 500`),
	foreignKey({ columns: [table.teamId], foreignColumns: [teams.id], name: "team_google_calendars_team_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.connectedByProfileId], foreignColumns: [profiles.id], name: "team_google_calendars_connected_by_profile_id_fkey" }).onDelete("set null"),
	pgPolicy("Team and coaches can view team calendar", { as: "permissive", for: "select", to: ["authenticated"], using: CAN_MANAGE_TEAM }),
	pgPolicy("Team and coaches can connect team calendar", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: CAN_MANAGE_TEAM }),
	pgPolicy("Team and coaches can update team calendar", { as: "permissive", for: "update", to: ["authenticated"], using: CAN_MANAGE_TEAM, withCheck: CAN_MANAGE_TEAM }),
	pgPolicy("Team and coaches can disconnect team calendar", { as: "permissive", for: "delete", to: ["authenticated"], using: CAN_MANAGE_TEAM }),
]).enableRLS()

export const calendarSyncStatus = pgEnum("calendar_sync_status", ["synced", "removed", "failed"])

// Per-session sync state. Written only by the server (service role) after a sync attempt.
export const trainingSessionCalendarEvents = pgTable("training_session_calendar_events", {
	trainingSessionId: uuid("training_session_id").primaryKey().notNull(),
	teamId: uuid("team_id").notNull(),
	status: calendarSyncStatus().notNull(),
	errorMessage: text("error_message"),
	attemptedAt: timestamp("attempted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("training_session_calendar_events_team_status_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("enum_ops")),
	check("training_session_calendar_events_error_check", sql`error_message IS NULL OR char_length(error_message) <= 1000`),
	foreignKey({ columns: [table.trainingSessionId], foreignColumns: [trainingSessions.id], name: "training_session_calendar_events_session_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.teamId], foreignColumns: [teams.id], name: "training_session_calendar_events_team_id_fkey" }).onDelete("cascade"),
	pgPolicy("Team and coaches can view calendar sync state", { as: "permissive", for: "select", to: ["authenticated"], using: CAN_MANAGE_TEAM }),
]).enableRLS()
