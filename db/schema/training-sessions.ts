// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
import { pgTable, foreignKey, pgPolicy, uuid, text, integer, timestamp, index, check, jsonb, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

import { profiles } from "./profiles"
import { rooms } from "./reservations"
import { attendanceStatus } from "./team-activities"
import { teams } from "./teams"

const OWN_TEAM_IDS = sql`(SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`
const OWN_TEAM_SESSION_IDS = sql`(SELECT id FROM training_sessions WHERE team_id IN ${OWN_TEAM_IDS})`

export const trainingSessions = pgTable("training_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teamId: uuid("team_id").notNull(),
	topic: text().notNull(),
	description: text(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }).notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }).notNull(),
	roomId: uuid("room_id"),
	locationNote: text("location_note"),
	guestCapacity: integer("guest_capacity").default(0).notNull(),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	cancelledByProfileId: uuid("cancelled_by_profile_id"),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("training_sessions_team_starts_at_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.startsAt.asc().nullsLast().op("timestamptz_ops")),
	index("training_sessions_starts_at_idx").using("btree", table.startsAt.asc().nullsLast().op("timestamptz_ops")).where(sql`removed_at IS NULL`),
	check("training_sessions_time_check", sql`ends_at > starts_at`),
	check("training_sessions_capacity_check", sql`guest_capacity >= 0 AND guest_capacity <= 50`),
	check("training_sessions_topic_check", sql`char_length(topic) >= 1 AND char_length(topic) <= 200`),
	check("training_sessions_description_check", sql`description IS NULL OR char_length(description) <= 2000`),
	check("training_sessions_location_note_check", sql`location_note IS NULL OR char_length(location_note) <= 200`),
	foreignKey({ columns: [table.teamId], foreignColumns: [teams.id], name: "training_sessions_team_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.roomId], foreignColumns: [rooms.id], name: "training_sessions_room_id_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.cancelledByProfileId], foreignColumns: [profiles.id], name: "training_sessions_cancelled_by_profile_id_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "training_sessions_created_by_profile_id_fkey" }).onDelete("restrict"),
	foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "training_sessions_updated_by_profile_id_fkey" }).onDelete("restrict"),
	pgPolicy("Authenticated can view training sessions", { as: "permissive", for: "select", to: ["authenticated"], using: sql`removed_at IS NULL` }),
	pgPolicy("Team members can create training sessions", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`team_id IN ${OWN_TEAM_IDS}` }),
	pgPolicy("Team members can update training sessions", { as: "permissive", for: "update", to: ["authenticated"], using: sql`team_id IN ${OWN_TEAM_IDS}`, withCheck: sql`team_id IN ${OWN_TEAM_IDS}` }),
]).enableRLS()

export const trainingSessionFacilitators = pgTable("training_session_facilitators", {
	trainingSessionId: uuid("training_session_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
}, (table) => [
	primaryKey({ columns: [table.trainingSessionId, table.profileId], name: "training_session_facilitators_pkey" }),
	index("training_session_facilitators_profile_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({ columns: [table.trainingSessionId], foreignColumns: [trainingSessions.id], name: "training_session_facilitators_session_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "training_session_facilitators_profile_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "training_session_facilitators_created_by_profile_id_fkey" }).onDelete("restrict"),
	pgPolicy("Authenticated can view facilitators", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Team members can add facilitators from their team", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS} AND profile_id IN (SELECT p.id FROM profiles p JOIN training_sessions s ON s.team_id = p.team_id WHERE s.id = training_session_id)` }),
	pgPolicy("Team members can remove facilitators", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
]).enableRLS()

export const trainingSessionPreparations = pgTable("training_session_preparations", {
	trainingSessionId: uuid("training_session_id").primaryKey().notNull(),
	contentJson: jsonb("content_json").notNull(),
	contentText: text("content_text").notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	foreignKey({ columns: [table.trainingSessionId], foreignColumns: [trainingSessions.id], name: "training_session_preparations_session_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "training_session_preparations_created_by_profile_id_fkey" }).onDelete("restrict"),
	foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "training_session_preparations_updated_by_profile_id_fkey" }).onDelete("restrict"),
	pgPolicy("Published preparation is public, drafts team only", { as: "permissive", for: "select", to: ["authenticated"], using: sql`published_at IS NOT NULL OR training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
	pgPolicy("Team members can create preparation", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
	pgPolicy("Team members can update preparation", { as: "permissive", for: "update", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}`, withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
]).enableRLS()

export const trainingSessionReflections = pgTable("training_session_reflections", {
	trainingSessionId: uuid("training_session_id").primaryKey().notNull(),
	contentJson: jsonb("content_json").notNull(),
	contentText: text("content_text").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	foreignKey({ columns: [table.trainingSessionId], foreignColumns: [trainingSessions.id], name: "training_session_reflections_session_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "training_session_reflections_created_by_profile_id_fkey" }).onDelete("restrict"),
	foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "training_session_reflections_updated_by_profile_id_fkey" }).onDelete("restrict"),
	pgPolicy("Team members can view reflection", { as: "permissive", for: "select", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
	pgPolicy("Team members can create reflection", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
	pgPolicy("Team members can update reflection", { as: "permissive", for: "update", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}`, withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
]).enableRLS()

export const trainingSessionAttendees = pgTable("training_session_attendees", {
	trainingSessionId: uuid("training_session_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	status: attendanceStatus().default("present").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	primaryKey({ columns: [table.trainingSessionId, table.profileId], name: "training_session_attendees_pkey" }),
	foreignKey({ columns: [table.trainingSessionId], foreignColumns: [trainingSessions.id], name: "training_session_attendees_session_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "training_session_attendees_profile_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "training_session_attendees_created_by_profile_id_fkey" }).onDelete("restrict"),
	foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "training_session_attendees_updated_by_profile_id_fkey" }).onDelete("restrict"),
	pgPolicy("Team members can view attendance", { as: "permissive", for: "select", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
	pgPolicy("Team members can record attendance of members and guests", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS} AND (profile_id IN (SELECT p.id FROM profiles p JOIN training_sessions s ON s.team_id = p.team_id WHERE s.id = training_session_id) OR profile_id IN (SELECT g.profile_id FROM training_session_guests g WHERE g.training_session_id = training_session_attendees.training_session_id))` }),
	pgPolicy("Team members can update attendance", { as: "permissive", for: "update", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}`, withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
	pgPolicy("Team members can delete attendance", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
]).enableRLS()

export const trainingSessionGuests = pgTable("training_session_guests", {
	trainingSessionId: uuid("training_session_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	primaryKey({ columns: [table.trainingSessionId, table.profileId], name: "training_session_guests_pkey" }),
	index("training_session_guests_profile_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({ columns: [table.trainingSessionId], foreignColumns: [trainingSessions.id], name: "training_session_guests_session_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "training_session_guests_profile_id_fkey" }).onDelete("cascade"),
	// Writes only via join_training_session / leave_training_session (SECURITY DEFINER).
	pgPolicy("Authenticated can view guests", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]).enableRLS()
