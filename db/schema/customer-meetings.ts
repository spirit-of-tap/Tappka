import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const customerMeetings = pgTable("customer_meetings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	meetingAt: timestamp("meeting_at", { withTimezone: true, mode: 'string' }),
	company: text().notNull(),
	contactPerson: text("contact_person").notNull(),
	position: text().notNull(),
	objective: text().notNull(),
	postMortem: text("post_mortem"),
	teamShare: text("team_share"),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("customer_meetings_profile_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	index("customer_meetings_created_desc_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "customer_meetings_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "customer_meetings_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "customer_meetings_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Users can view their own customer meetings", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can create their own customer meetings", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can update their own customer meetings", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(profile_id = current_profile_id())`, withCheck: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can delete their own customer meetings", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
]).enableRLS()
