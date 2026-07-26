// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
// Note: created_by/updated_by FKs to profiles are omitted here to avoid a teams↔profiles import cycle.
// They are expressed in SQL migrations / live DB constraints.
import { pgTable, pgPolicy, uuid, text, timestamp, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const teams = pgTable("teams", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	picture: text(),
	color: text(),
	onboardingYear: integer(),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id"),
	updatedByProfileId: uuid("updated_by_profile_id"),
}, () => [
	pgPolicy("Authenticated users can read teams", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]).enableRLS();
