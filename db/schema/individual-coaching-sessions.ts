import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, index, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const individualCoachingSessions = pgTable("individual_coaching_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	sessionAt: timestamp("session_at", { withTimezone: true, mode: 'string' }),
	coachProfileId: uuid("coach_profile_id"),
	externalCoachName: text("external_coach_name"),
	keyTakeaways: text("key_takeaways"),
	actionSteps: text("action_steps"),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("individual_coaching_sessions_profile_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	index("individual_coaching_sessions_coach_idx").using("btree", table.coachProfileId.asc().nullsLast().op("uuid_ops")),
	index("individual_coaching_sessions_created_desc_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "individual_coaching_sessions_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.coachProfileId],
			foreignColumns: [profiles.id],
			name: "individual_coaching_sessions_coach_profile_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "individual_coaching_sessions_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "individual_coaching_sessions_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	check("individual_coaching_sessions_coach_xor", sql`(coach_profile_id IS NOT NULL) <> (external_coach_name IS NOT NULL)`),
	pgPolicy("Users can view their own coaching sessions", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can create their own coaching sessions", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can update their own coaching sessions", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(profile_id = current_profile_id())`, withCheck: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can delete their own coaching sessions", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
]).enableRLS()
