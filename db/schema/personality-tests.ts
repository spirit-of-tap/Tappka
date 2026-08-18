// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, date, integer, index, check, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const personalityTestType = pgEnum("personality_test_type", [
  "gallup",
  "mbti",
  "disc",
  "big_five",
  "enneagram",
  "belbin",
  "other",
])

export const personalityTests = pgTable("personality_tests", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  profileId: uuid("profile_id").notNull(),
  testType: personalityTestType("test_type").notNull(),
  testTypeOther: text("test_type_other"),
  testedOn: date("tested_on").notNull(),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  index("personality_tests_profile_tested_on_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops"), table.testedOn.asc().nullsLast().op("date_ops")),
  foreignKey({
    columns: [table.profileId],
    foreignColumns: [profiles.id],
    name: "personality_tests_profile_id_fkey"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.createdByProfileId],
    foreignColumns: [profiles.id],
    name: "personality_tests_created_by_profile_id_fkey"
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.updatedByProfileId],
    foreignColumns: [profiles.id],
    name: "personality_tests_updated_by_profile_id_fkey"
  }).onDelete("restrict"),
  check("personality_tests_other_type_required", sql`(test_type <> 'other' OR (test_type_other IS NOT NULL AND length(trim(test_type_other)) > 0))`),
  pgPolicy("Verified users can view personality tests", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(removed_at IS NULL) AND (EXISTS (SELECT 1 FROM users WHERE (users.auth_user_id = (SELECT auth.uid()) AND users.verified_work_email IS NOT NULL)))` }),
  pgPolicy("Users can create their own personality tests", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(profile_id = current_profile_id())` }),
  pgPolicy("Users can update their own personality tests", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(profile_id = current_profile_id())`, withCheck: sql`(profile_id = current_profile_id())` }),
  pgPolicy("Users can delete their own personality tests", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
]).enableRLS()
