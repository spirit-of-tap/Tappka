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
	groupPicture: text("group_picture"),
	color: text(),
	onboardingYear: integer(),
	websiteUrl: text("website_url"),
	instagramUrl: text("instagram_url"),
	linkedinUrl: text("linkedin_url"),
	ico: text("ico"),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id"),
	updatedByProfileId: uuid("updated_by_profile_id"),
}, () => [
	pgPolicy("Authenticated users can read teams", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Team members and admins can update teams", {
		as: "permissive",
		for: "update",
		to: ["authenticated"],
		using: sql`id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) OR EXISTS (SELECT 1 FROM profiles WHERE id = current_profile_id() AND role = 'admin' AND access_removed_at IS NULL)`,
		withCheck: sql`id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) OR EXISTS (SELECT 1 FROM profiles WHERE id = current_profile_id() AND role = 'admin' AND access_removed_at IS NULL)`
	}),
]).enableRLS();
