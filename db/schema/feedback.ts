// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// To change the schema: edit here, then `pnpm db:generate` and apply the migration.
import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, index, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const feedback = pgTable("feedback", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authorProfileId: uuid("author_profile_id").notNull(),
	body: text().notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("feedback_active_created_idx").using("btree", table.resolvedAt.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("feedback_author_idx").using("btree", table.authorProfileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.authorProfileId],
			foreignColumns: [profiles.id],
			name: "feedback_author_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "feedback_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "feedback_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Authenticated users can view feedback", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Authenticated users can create feedback", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(author_profile_id = current_profile_id())` }),
	pgPolicy("Admins can update feedback", { as: "permissive", for: "update", to: ["authenticated"], using: sql`is_admin()`, withCheck: sql`is_admin()` }),
	pgPolicy("Authors and admins can delete feedback", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`((author_profile_id = current_profile_id()) OR is_admin())` }),
	check("feedback_body_check", sql`(char_length(body) >= 1) AND (char_length(body) <= 4000)`),
]).enableRLS();
