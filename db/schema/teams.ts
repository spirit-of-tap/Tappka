// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// To change the schema: edit here, then `npx drizzle-kit generate` and apply the migration.
import { pgTable, pgPolicy, uuid, text, timestamp, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const teams = pgTable("teams", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	picture: text(),
	color: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	year: integer(),
}, (table) => [
	pgPolicy("Authenticated users can read teams", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]);
