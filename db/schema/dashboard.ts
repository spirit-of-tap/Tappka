import { pgTable, foreignKey, pgPolicy, uuid, jsonb, timestamp } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const dashboardLayouts = pgTable("dashboard_layouts", {
	profileId: uuid("profile_id").primaryKey().notNull(),
	widgets: jsonb().default([]).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "dashboard_layouts_profile_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete their own dashboard layout", { as: "permissive", for: "delete", to: ["public"], using: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can update their own dashboard layout", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can insert their own dashboard layout", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view their own dashboard layout", { as: "permissive", for: "select", to: ["public"] }),
]);
