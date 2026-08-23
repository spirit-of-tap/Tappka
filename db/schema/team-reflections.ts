import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, date, uniqueIndex, index, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { teams } from "./teams"
import { profiles } from "./profiles"

export const teamReflections = pgTable("team_reflections", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teamId: uuid("team_id").notNull(),
	month: date("month").notNull(),
	whatWentWell: text("what_went_well"),
	whatDidntGoWell: text("what_didnt_go_well"),
	whatWeDoDifferently: text("what_we_do_differently"),
	plannedActionSteps: text("planned_action_steps"),
	responsiblePerson: text("responsible_person"),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	uniqueIndex("team_reflections_team_month_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.month.asc().nullsLast().op("date_ops")).where(sql`(removed_at IS NULL)`),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_reflections_team_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "team_reflections_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "team_reflections_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Team members can view reflections", { as: "permissive", for: "select", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can create reflections", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can update reflections", { as: "permissive", for: "update", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`, withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can delete reflections", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
]).enableRLS()

export const teamReflectionActionSteps = pgTable("team_reflection_action_steps", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teamReflectionId: uuid("team_reflection_id").notNull(),
	description: text().notNull(),
	assigneeProfileId: uuid("assignee_profile_id"),
	customAssignee: text("custom_assignee"),
	orderIndex: integer("order_index").default(0).notNull(),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id"),
}, (table) => [
	index("team_reflection_action_steps_reflection_idx").using("btree", table.teamReflectionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.teamReflectionId],
		foreignColumns: [teamReflections.id],
		name: "team_reflection_action_steps_team_reflection_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.assigneeProfileId],
		foreignColumns: [profiles.id],
		name: "team_reflection_action_steps_assignee_profile_id_fkey"
	}).onDelete("set null"),
	foreignKey({
		columns: [table.createdByProfileId],
		foreignColumns: [profiles.id],
		name: "team_reflection_action_steps_created_by_profile_id_fkey"
	}).onDelete("set null"),
	pgPolicy("Team members can view action steps", { as: "permissive", for: "select", to: ["authenticated"], using: sql`team_reflection_id IN (SELECT id FROM team_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))` }),
	pgPolicy("Team members can create action steps", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`team_reflection_id IN (SELECT id FROM team_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))` }),
	pgPolicy("Team members can update action steps", { as: "permissive", for: "update", to: ["authenticated"], using: sql`team_reflection_id IN (SELECT id FROM team_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))`, withCheck: sql`team_reflection_id IN (SELECT id FROM team_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))` }),
	pgPolicy("Team members can delete action steps", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`team_reflection_id IN (SELECT id FROM team_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))` }),
]).enableRLS()
