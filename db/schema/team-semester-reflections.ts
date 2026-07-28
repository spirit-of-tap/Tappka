// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, date, uniqueIndex, index, check, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { teams } from "./teams"
import { profiles } from "./profiles"

export const semesterReflectionTopic = pgEnum("semester_reflection_topic", [
	'predmety_zkousky_vyucujici',
	'metodika_a_metriky',
	'kouci_a_mentori',
	'tymy_a_tymove_spolecnosti',
	'individualni_prinos',
	'komunita',
	'komunitni_role',
	'komunitni_akce',
	'komunitni_a_cross_projekty',
	'zacleneni_tucnaku',
	'dalsi',
])

export const teamSemesterReflections = pgTable("team_semester_reflections", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teamId: uuid("team_id").notNull(),
	semesterMonth: date("semester_month").notNull(),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	uniqueIndex("team_semester_reflections_team_month_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.semesterMonth.asc().nullsLast().op("date_ops")).where(sql`(removed_at IS NULL)`),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_semester_reflections_team_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "team_semester_reflections_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "team_semester_reflections_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	check("team_semester_reflections_month_check", sql`EXTRACT(MONTH FROM semester_month) IN (1, 5)`),
	pgPolicy("Team members can view semester reflections", { as: "permissive", for: "select", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can create semester reflections", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can update semester reflections", { as: "permissive", for: "update", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`, withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can delete semester reflections", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
]).enableRLS()

export const teamSemesterReflectionEntries = pgTable("team_semester_reflection_entries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	semesterReflectionId: uuid("semester_reflection_id").notNull(),
	topic: semesterReflectionTopic().notNull(),
	whatWentWell: text("what_went_well"),
	whatDidntGoWell: text("what_didnt_go_well"),
	whatNextTime: text("what_next_time"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	uniqueIndex("team_semester_reflection_entries_reflection_topic_idx").using("btree", table.semesterReflectionId.asc().nullsLast().op("uuid_ops"), table.topic.asc().nullsLast().op("enum_ops")),
	index("team_semester_reflection_entries_reflection_idx").using("btree", table.semesterReflectionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.semesterReflectionId],
			foreignColumns: [teamSemesterReflections.id],
			name: "team_semester_reflection_entries_semester_reflection_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "team_semester_reflection_entries_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Team members can view semester reflection entries", { as: "permissive", for: "select", to: ["authenticated"], using: sql`EXISTS (SELECT 1 FROM team_semester_reflections tsr WHERE tsr.id = team_semester_reflection_entries.semester_reflection_id AND tsr.team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))` }),
	pgPolicy("Team members can create semester reflection entries", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`EXISTS (SELECT 1 FROM team_semester_reflections tsr WHERE tsr.id = team_semester_reflection_entries.semester_reflection_id AND tsr.team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))` }),
	pgPolicy("Team members can update semester reflection entries", { as: "permissive", for: "update", to: ["authenticated"], using: sql`EXISTS (SELECT 1 FROM team_semester_reflections tsr WHERE tsr.id = team_semester_reflection_entries.semester_reflection_id AND tsr.team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))`, withCheck: sql`EXISTS (SELECT 1 FROM team_semester_reflections tsr WHERE tsr.id = team_semester_reflection_entries.semester_reflection_id AND tsr.team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))` }),
]).enableRLS()
