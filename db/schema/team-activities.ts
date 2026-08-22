import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, date, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { teams } from "./teams"
import { profiles } from "./profiles"

export const teamActivities = pgTable("team_activities", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teamId: uuid("team_id").notNull(),
	occurredAt: date("occurred_at").notNull(),
	activityType: text("activity_type").notNull(),
	participants: text("participants"),
	reason: text("reason"),
	reflection: text("reflection"),
	imagePath: text("image_path"),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("team_activities_team_occurred_at_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.occurredAt.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_activities_team_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "team_activities_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "team_activities_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Team members can view activities", { as: "permissive", for: "select", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can create activities", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can update activities", { as: "permissive", for: "update", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`, withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
	pgPolicy("Team members can delete activities", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
]).enableRLS()
