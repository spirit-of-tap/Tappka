// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
//
// Design: docs/plans/2026-09-24-timetracking-design.md
//
// Not modelled here (drizzle-kit cannot express them, applied via custom migration):
// - EXCLUDE constraint `time_entries_no_overlap` (btree_gist) — one person's entries never overlap.
// - Trigger `team_activity_attendees_sync_time_entry` — auto `training` entry from TS attendance.
import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, bigint, index, uniqueIndex, check, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"
import { teamActivityAttendees } from "./team-activities"

export const timeDirection = pgEnum("time_direction", ["training", "reading", "practise"])

export const timeEntrySource = pgEnum("time_entry_source", ["timer", "manual", "attendance"])

/** Visible to the owner, their active teammates, coaches and admins. */
const TEAM_OR_STAFF_READ = sql`(
	profile_id = current_profile_id()
	OR is_coach_or_admin()
	OR profile_id IN (
		SELECT p.id FROM profiles p
		WHERE p.team_id IS NOT NULL
			AND p.access_removed_at IS NULL
			AND p.team_id = (SELECT team_id FROM profiles WHERE id = current_profile_id())
	)
)`

export const timeTags = pgTable("time_tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	uniqueIndex("time_tags_profile_name_key").using("btree", table.profileId.asc().nullsLast().op("uuid_ops"), sql`lower(btrim(${table.name}))`),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "time_tags_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "time_tags_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "time_tags_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	check("time_tags_name_check", sql`char_length(btrim(${table.name})) BETWEEN 1 AND 40`),
	pgPolicy("Team, coaches and admins can view time tags", { as: "permissive", for: "select", to: ["authenticated"], using: TEAM_OR_STAFF_READ }),
	pgPolicy("Users can create own time tags", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`profile_id = current_profile_id()` }),
	pgPolicy("Users can update own time tags", { as: "permissive", for: "update", to: ["authenticated"], using: sql`profile_id = current_profile_id()`, withCheck: sql`profile_id = current_profile_id()` }),
	pgPolicy("Users can delete own time tags", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`profile_id = current_profile_id()` }),
]).enableRLS()

export const timeEntries = pgTable("time_entries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	direction: timeDirection().notNull(),
	tagId: uuid("tag_id"),
	title: text(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).notNull(),
	/** NULL = running timer. */
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
	/** Materialised `ended_at - started_at` in ms; NULL while running. */
	durationMs: bigint("duration_ms", { mode: "number" }),
	source: timeEntrySource().default("manual").notNull(),
	/** Set only on rows created by the TS attendance trigger. */
	attendanceId: uuid("attendance_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("time_entries_profile_started_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops"), table.startedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("time_entries_tag_idx").using("btree", table.tagId.asc().nullsLast().op("uuid_ops")).where(sql`(tag_id IS NOT NULL)`),
	uniqueIndex("time_entries_one_running_key").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")).where(sql`(ended_at IS NULL)`),
	uniqueIndex("time_entries_attendance_id_key").using("btree", table.attendanceId.asc().nullsLast().op("uuid_ops")).where(sql`(attendance_id IS NOT NULL)`),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "time_entries_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [timeTags.id],
			name: "time_entries_tag_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.attendanceId],
			foreignColumns: [teamActivityAttendees.id],
			name: "time_entries_attendance_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "time_entries_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "time_entries_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	check("time_entries_title_check", sql`${table.title} IS NULL OR char_length(${table.title}) <= 120`),
	check("time_entries_end_after_start", sql`${table.endedAt} IS NULL OR ${table.endedAt} > ${table.startedAt}`),
	check("time_entries_duration_matches", sql`(
		(${table.endedAt} IS NULL AND ${table.durationMs} IS NULL)
		OR (${table.endedAt} IS NOT NULL AND ${table.durationMs} IS NOT NULL AND ${table.durationMs} = (extract(epoch FROM (${table.endedAt} - ${table.startedAt})) * 1000)::bigint)
	)`),
	pgPolicy("Team, coaches and admins can view time entries", { as: "permissive", for: "select", to: ["authenticated"], using: TEAM_OR_STAFF_READ }),
	pgPolicy("Users can create own time entries", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`profile_id = current_profile_id() AND source <> 'attendance'` }),
	pgPolicy("Users can update own time entries", { as: "permissive", for: "update", to: ["authenticated"], using: sql`profile_id = current_profile_id()`, withCheck: sql`profile_id = current_profile_id()` }),
	pgPolicy("Users can delete own time entries", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`profile_id = current_profile_id()` }),
]).enableRLS()
