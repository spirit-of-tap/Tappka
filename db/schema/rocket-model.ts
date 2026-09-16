// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Rocket Model: team-learning checklists with individual + team levels.
// Content (categories/items) is reference data — readable by all, writable by coaches/admins.
// Individual states are visible to teammates (team summary needs who-has-what).
import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, index, unique, boolean, integer, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { teams } from "./teams"
import { profiles } from "./profiles"

export const rocketCategories = pgTable("rocket_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: text().notNull(),
	title: text().notNull(),
	orderIndex: integer("order_index").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("rocket_categories_code_key").on(table.code),
	pgPolicy("Authenticated users can view rocket categories", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Coaches and admins can add rocket categories", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can update rocket categories", { as: "permissive", for: "update", to: ["authenticated"], using: sql`is_coach_or_admin()`, withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can delete rocket categories", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`is_coach_or_admin()` }),
]).enableRLS()

export const rocketItems = pgTable("rocket_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	categoryId: uuid("category_id").notNull(),
	orderIndex: integer("order_index").default(0).notNull(),
	textCs: text("text_cs").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("rocket_items_category_idx").using("btree", table.categoryId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [rocketCategories.id],
			name: "rocket_items_category_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Authenticated users can view rocket items", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Coaches and admins can add rocket items", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can update rocket items", { as: "permissive", for: "update", to: ["authenticated"], using: sql`is_coach_or_admin()`, withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can delete rocket items", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`is_coach_or_admin()` }),
]).enableRLS()

export const rocketIndividualStates = pgTable("rocket_individual_states", {
	itemId: uuid("item_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	isChecked: boolean("is_checked").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	primaryKey({ columns: [table.itemId, table.profileId], name: "rocket_individual_states_pkey" }),
	index("rocket_individual_states_profile_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [rocketItems.id],
			name: "rocket_individual_states_item_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "rocket_individual_states_profile_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Teammates can view individual states", { as: "permissive", for: "select", to: ["authenticated"], using: sql`profile_id IN (SELECT id FROM profiles WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))` }),
	pgPolicy("Users can insert own individual states", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can update own individual states", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(profile_id = current_profile_id())`, withCheck: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can delete own individual states", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
]).enableRLS()

export const rocketIndividualHistory = pgTable("rocket_individual_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	itemId: uuid("item_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	isChecked: boolean("is_checked").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
}, (table) => [
	index("rocket_individual_history_item_profile_idx").using("btree", table.itemId.asc().nullsLast().op("uuid_ops"), table.profileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [rocketItems.id],
			name: "rocket_individual_history_item_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "rocket_individual_history_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "rocket_individual_history_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Teammates can view individual history", { as: "permissive", for: "select", to: ["authenticated"], using: sql`profile_id IN (SELECT id FROM profiles WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))` }),
	pgPolicy("Users can log own individual history", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`((profile_id = current_profile_id()) AND (created_by_profile_id = current_profile_id()))` }),
]).enableRLS()

export const rocketTeamChecks = pgTable("rocket_team_checks", {
	teamId: uuid("team_id").notNull(),
	itemId: uuid("item_id").notNull(),
	isChecked: boolean("is_checked").default(false).notNull(),
	checkedByProfileId: uuid("checked_by_profile_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	primaryKey({ columns: [table.teamId, table.itemId], name: "rocket_team_checks_pkey" }),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "rocket_team_checks_team_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [rocketItems.id],
			name: "rocket_team_checks_item_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.checkedByProfileId],
			foreignColumns: [profiles.id],
			name: "rocket_team_checks_checked_by_profile_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Team members can view team checks", { as: "permissive", for: "select", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can create team checks", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can update team checks", { as: "permissive", for: "update", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`, withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can delete team checks", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
]).enableRLS()

export const rocketTeamHistory = pgTable("rocket_team_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teamId: uuid("team_id").notNull(),
	itemId: uuid("item_id").notNull(),
	isChecked: boolean("is_checked").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
}, (table) => [
	index("rocket_team_history_team_item_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.itemId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "rocket_team_history_team_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [rocketItems.id],
			name: "rocket_team_history_item_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "rocket_team_history_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Team members can view team history", { as: "permissive", for: "select", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can log team history", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`((team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)) AND (created_by_profile_id = current_profile_id()))` }),
]).enableRLS()
