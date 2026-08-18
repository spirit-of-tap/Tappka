import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, index, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const toolType = pgEnum("tool_type", ['model', 'technique', 'tool'])

export const toolsTechniques = pgTable("tools_techniques", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	toolType: toolType("tool_type").notNull(),
	name: text("name").notNull(),
	reflection: text("reflection").notNull(),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("tools_techniques_profile_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "tools_techniques_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "tools_techniques_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "tools_techniques_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Users can view their own tools and techniques", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can create their own tools and techniques", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can update their own tools and techniques", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(profile_id = current_profile_id())`, withCheck: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can delete their own tools and techniques", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
]).enableRLS()
