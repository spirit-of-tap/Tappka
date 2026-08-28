// db/schema/content-sources.ts
// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { pgTable, foreignKey, pgPolicy, uuid, text, numeric, timestamp, index, check, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const contentSourceKind = pgEnum("content_source_kind", ['podcast', 'conference', 'program', 'other'])
export const contentSourceStatus = pgEnum("content_source_status", ['pending_review', 'approved', 'archived'])

export const contentSources = pgTable("content_sources", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	kind: contentSourceKind().notNull(),
	title: text().notNull(),
	creator: text(),
	description: text(),
	externalUrl: text("external_url"),
	points: numeric("points", { precision: 3, scale: 2 }),
	status: contentSourceStatus().default('pending_review').notNull(),
	statusChangedAt: timestamp("status_changed_at", { withTimezone: true, mode: 'string' }),
	statusChangedByProfileId: uuid("status_changed_by_profile_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("content_sources_created_by_idx").using("btree", table.createdByProfileId.asc().nullsLast().op("uuid_ops")),
	index("content_sources_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "content_sources_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "content_sources_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.statusChangedByProfileId],
			foreignColumns: [profiles.id],
			name: "content_sources_status_changed_by_profile_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Authenticated users can view all content sources", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	// A student may only ever file a source for review: without the status clause
	// they could POST straight to PostgREST with status 'approved' and any points,
	// skipping the API route and the coach queue entirely.
	pgPolicy("Authenticated users can add content sources", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`((created_by_profile_id = current_profile_id()) AND (status = 'pending_review'::content_source_status))` }),
	pgPolicy("Coaches and admins can update content sources", { as: "permissive", for: "update", to: ["authenticated"], using: sql`is_coach_or_admin()`, withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can delete content sources", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`is_coach_or_admin()` }),
	check("content_sources_points_check", sql`(points IS NULL) OR ((points >= (0)::numeric) AND (points <= (3)::numeric))`),
]).enableRLS();
