// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// To change the schema: edit here, then `npx drizzle-kit generate` and apply the migration.
import { pgTable, foreignKey, pgPolicy, uuid, jsonb, timestamp } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const dashboardLayouts = pgTable("dashboard_layouts", {
	profileId: uuid("profile_id").primaryKey().notNull(),
	widgets: jsonb().default([]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "dashboard_layouts_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "dashboard_layouts_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "dashboard_layouts_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Users can delete their own dashboard layout", { as: "permissive", for: "delete", to: ["public"], using: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can update their own dashboard layout", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can insert their own dashboard layout", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view their own dashboard layout", { as: "permissive", for: "select", to: ["public"] }),
]).enableRLS();
