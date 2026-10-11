// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
//
// Design: docs/plans/2026-09-24-timetracking-design.md
//
// Not modelled here (drizzle-kit cannot express them, applied via custom migration):
// - EXCLUDE constraint `time_entries_no_overlap` (btree_gist) — one person's entries never overlap.
// - Trigger `team_activity_attendees_sync_time_entry` — auto `training` entry (tag TS) from TS attendance.
// - Seed rows of the system tags (Training: TS, Příprava na TS; Reading: Čtení, Esej).
import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, bigint, index, uniqueIndex, unique, check, pgEnum, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"
import { teams } from "./teams"
import { teamActivityAttendees } from "./team-activities"

export const timeDirection = pgEnum("time_direction", ["training", "reading", "practise", "project"])

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

/** The caller's team (NULL for coaches / admins without a team, or removed access). */
const CURRENT_TEAM = sql`(SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`

/**
 * Tags are shared by a team, never personal:
 * - Training and Reading have fixed system tags (`team_id IS NULL`, `system_key` set) that
 *   nobody can add, rename, delete or hide (seeded by migration).
 * - Practise and Projekt tags belong to a team; any member creates them, the creator or a
 *   coach / admin renames or deletes them. Each person picks which ones they see
 *   (`time_tag_selections`); a new tag is hidden until picked.
 */
export const timeTags = pgTable("time_tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	/** NULL = system tag shared by everyone. */
	teamId: uuid("team_id"),
	/** Stable key of a system tag (e.g. `training_session`); NULL for team tags. */
	systemKey: text("system_key"),
	/** Every tag belongs to exactly one direction; entries may only use tags of their own direction. */
	direction: timeDirection().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	/** NULL for system tags and after the creator's profile is deleted. */
	createdByProfileId: uuid("created_by_profile_id"),
	updatedByProfileId: uuid("updated_by_profile_id"),
}, (table) => [
	uniqueIndex("time_tags_team_direction_name_key").using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.direction.asc().nullsLast().op("enum_ops"), sql`lower(btrim(${table.name}))`),
	uniqueIndex("time_tags_system_key_key").using("btree", table.systemKey.asc().nullsLast().op("text_ops")).where(sql`(system_key IS NOT NULL)`),
	index("time_tags_team_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops")).where(sql`(team_id IS NOT NULL)`),
	/** Target of the composite FK from `time_entries (tag_id, direction)`. */
	unique("time_tags_id_direction_key").on(table.id, table.direction),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "time_tags_team_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "time_tags_created_by_profile_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "time_tags_updated_by_profile_id_fkey"
		}).onDelete("set null"),
	check("time_tags_name_check", sql`char_length(btrim(${table.name})) BETWEEN 1 AND 40`),
	// System tags exist only for Training / Reading, team tags only for Practise / Projekt.
	check("time_tags_scope_check", sql`(
		(${table.teamId} IS NULL AND ${table.systemKey} IS NOT NULL AND ${table.direction} IN ('training', 'reading'))
		OR (${table.teamId} IS NOT NULL AND ${table.systemKey} IS NULL AND ${table.direction} IN ('practise', 'project'))
	)`),
	pgPolicy("Team, coaches and admins can view time tags", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(team_id IS NULL OR is_coach_or_admin() OR team_id = ${CURRENT_TEAM})` }),
	pgPolicy("Team members can create team time tags", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(team_id = ${CURRENT_TEAM} AND created_by_profile_id = current_profile_id())` }),
	pgPolicy("Creators, coaches and admins can update team time tags", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(team_id IS NOT NULL AND (created_by_profile_id = current_profile_id() OR is_coach_or_admin()))`, withCheck: sql`(team_id IS NOT NULL AND ((team_id = ${CURRENT_TEAM} AND created_by_profile_id = current_profile_id()) OR is_coach_or_admin()))` }),
	pgPolicy("Creators, coaches and admins can delete team time tags", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(team_id IS NOT NULL AND (created_by_profile_id = current_profile_id() OR is_coach_or_admin()))` }),
]).enableRLS()

/** Team tags a person chose to see in their tag picker (Practise / Projekt). */
export const timeTagSelections = pgTable("time_tag_selections", {
	profileId: uuid("profile_id").notNull(),
	tagId: uuid("tag_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	primaryKey({ columns: [table.profileId, table.tagId], name: "time_tag_selections_pkey" }),
	index("time_tag_selections_tag_idx").using("btree", table.tagId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "time_tag_selections_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [timeTags.id],
			name: "time_tag_selections_tag_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can view own time tag selections", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can create own time tag selections", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(profile_id = current_profile_id() AND tag_id IN (SELECT id FROM time_tags WHERE team_id = ${CURRENT_TEAM}))` }),
	pgPolicy("Users can delete own time tag selections", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
]).enableRLS()

/** Per-person Čas settings. */
export const timeTrackingPreferences = pgTable("time_tracking_preferences", {
	profileId: uuid("profile_id").primaryKey().notNull(),
	/** Team tags created after this are announced as new in the tag picker; NULL = never reviewed. */
	tagsReviewedAt: timestamp("tags_reviewed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "time_tracking_preferences_profile_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can view own time tracking preferences", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can insert own time tracking preferences", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can update own time tracking preferences", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(profile_id = current_profile_id())`, withCheck: sql`(profile_id = current_profile_id())` }),
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
	// The tag must belong to the entry's direction. Deleting a tag is handled by the FK
	// above (SET NULL tag_id), after which this one is satisfied (MATCH SIMPLE); changing a
	// used tag's direction or an entry's direction to a mismatch is rejected.
	foreignKey({
			columns: [table.tagId, table.direction],
			foreignColumns: [timeTags.id, timeTags.direction],
			name: "time_entries_tag_direction_fkey"
		}),
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
