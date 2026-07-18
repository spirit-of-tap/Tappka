// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// To change the schema: edit here, then `npx drizzle-kit generate` and apply the migration.
import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, index, unique, check, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { authUsers } from "drizzle-orm/supabase"
import { teams } from "./teams"

export const profileRole = pgEnum("profile_role", ['student', 'mentor', 'coach', 'admin'])

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authUserId: uuid("auth_user_id"),
	googleEmail: text("google_email").notNull(),
	suggestedWorkEmail: text("suggested_work_email"),
	verifiedWorkEmail: text("verified_work_email"),
	verifiedWorkEmailAt: timestamp("verified_work_email_at", { withTimezone: true, mode: 'string' }),
	lastOtpSentAt: timestamp("last_otp_sent_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("users_google_email_idx").using("btree", table.googleEmail.asc().nullsLast().op("text_ops")),
	index("users_suggested_work_email_idx").using("btree", table.suggestedWorkEmail.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.authUserId],
			foreignColumns: [authUsers.id],
			name: "users_auth_user_id_fkey"
		}).onDelete("cascade"),
	unique("users_auth_user_id_key").on(table.authUserId),
	unique("users_google_email_key").on(table.googleEmail),
	pgPolicy("Users can update only suggested_work_email", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(( SELECT auth.uid() AS uid) = auth_user_id)`, withCheck: sql`(( SELECT auth.uid() AS uid) = auth_user_id)`  }),
	pgPolicy("Users can insert their own user record", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can view their own user record", { as: "permissive", for: "select", to: ["authenticated"] }),
]).enableRLS();

export const profiles = pgTable("profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	picture: text(),
	userId: uuid("user_id"),
	workEmail: text("work_email").notNull(),
	role: profileRole().default('student').notNull(),
	teamId: uuid("team_id"),
	phoneNumber: text("phone_number"),
	personalEmail: text("personal_email"),
	dateOfBirth: date("date_of_birth"),
	accessRemovedAt: timestamp("access_removed_at", { withTimezone: true, mode: 'string' }),
	accessRemovedByProfileId: uuid("access_removed_by_profile_id"),
	betaAccessGrantedAt: timestamp("beta_access_granted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id"),
	updatedByProfileId: uuid("updated_by_profile_id"),
}, (table) => [
	index("profiles_team_id_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops")),
	index("profiles_team_id_user_id_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.userId.asc().nullsLast().op("uuid_ops")),
	index("profiles_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("profiles_work_email_idx").using("btree", table.workEmail.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "profiles_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "profiles_team_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.accessRemovedByProfileId],
			foreignColumns: [table.id],
			name: "profiles_access_removed_by_profile_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [table.id],
			name: "profiles_created_by_profile_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [table.id],
			name: "profiles_updated_by_profile_id_fkey"
		}).onDelete("set null"),
	unique("profiles_user_id_key").on(table.userId),
	unique("profiles_work_email_key").on(table.workEmail),
	pgPolicy("Verified users can view all profiles", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((access_removed_at IS NULL) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.verified_work_email IS NOT NULL)))))` }),
	pgPolicy("Users can update their own profile picture", { as: "permissive", for: "update", to: ["authenticated"] }),
	check("valid_czu_domain", sql`(lower(split_part(work_email, '@'::text, 2)) = ANY (ARRAY['pef.czu.cz'::text, 'studenti.czu.cz'::text, 'rektorat.czu.cz'::text]))`),
]).enableRLS();
