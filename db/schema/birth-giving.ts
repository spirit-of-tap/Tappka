// Schema source of truth (drizzle-kit only; NOT imported at runtime - app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { profiles } from "./profiles"

export const birthGivingDuration = pgEnum("birth_giving_duration", ["8h", "24h"])
export const birthGivingEventStatus = pgEnum("birth_giving_event_status", ["draft", "published"])
export const birthGivingAssignmentState = pgEnum("birth_giving_assignment_state", ["present", "missing", "none"])
export const birthGivingTeamResultState = pgEnum("birth_giving_team_result_state", ["pending", "present", "missing"])

const ACTIVE_BIRTH_GIVING_CALLER = sql`EXISTS (
  SELECT 1
  FROM profiles caller_profile
  JOIN users caller_user ON caller_user.id = caller_profile.user_id
  WHERE caller_profile.id = current_profile_id()
    AND caller_profile.access_removed_at IS NULL
    AND caller_profile.beta_access_granted_at IS NOT NULL
    AND caller_user.verified_work_email IS NOT NULL
)`

const BIRTH_GIVING_EVENT_VISIBLE = (eventId: AnyPgColumn) => sql`EXISTS (
      SELECT 1 FROM birth_giving_events event
      WHERE event.id = ${eventId}
        AND event.removed_at IS NULL
        AND (event.status = 'published' OR current_profile_id() = ANY(event.organizer_profile_ids))
    )`

export const birthGivingEvents = pgTable("birth_giving_events", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  customer: text().notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "string" }).notNull(),
  duration: birthGivingDuration().notNull(),
  status: birthGivingEventStatus().default("draft").notNull(),
  organizerProfileIds: uuid("organizer_profile_ids").array().notNull(),
  assignmentState: birthGivingAssignmentState("assignment_state").default("none").notNull(),
  assignmentStoragePath: text("assignment_storage_path"),
  assignmentFileName: text("assignment_file_name"),
  assignmentMimeType: text("assignment_mime_type"),
  assignmentFileSize: bigint("assignment_file_size", { mode: "number" }),
  assignmentUploadedAt: timestamp("assignment_uploaded_at", { withTimezone: true, mode: "string" }),
  assignmentUploadedByProfileId: uuid("assignment_uploaded_by_profile_id"),
  removedAt: timestamp("removed_at", { withTimezone: true, mode: "string" }),
  removedByProfileId: uuid("removed_by_profile_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  uniqueIndex("birth_giving_events_identity_idx").using(
    "btree",
    sql`lower(regexp_replace(trim(normalize(${table.name}, NFKC)), '[[:space:]]+', ' ', 'g'))`,
    sql`lower(regexp_replace(trim(normalize(${table.customer}, NFKC)), '[[:space:]]+', ' ', 'g'))`,
    table.startsAt.asc().nullsLast().op("timestamptz_ops"),
  ),
  index("birth_giving_events_status_starts_at_idx").on(table.status, table.startsAt),
  foreignKey({ columns: [table.removedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_events_removed_by_profile_id_fkey" }).onDelete("set null"),
  foreignKey({ columns: [table.assignmentUploadedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_events_assignment_uploaded_by_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_events_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_events_updated_by_profile_id_fkey" }).onDelete("restrict"),
  check("birth_giving_events_name_check", sql`length(trim(${table.name})) > 0`),
  check("birth_giving_events_customer_check", sql`length(trim(${table.customer})) > 0`),
  check("birth_giving_events_organizers_check", sql`cardinality(${table.organizerProfileIds}) > 0 AND cardinality(array_remove(${table.organizerProfileIds}, NULL)) = cardinality(${table.organizerProfileIds})`),
  check("birth_giving_events_assignment_check", sql`(
    ${table.assignmentState} = 'present'
    AND ${table.assignmentStoragePath} IS NOT NULL
    AND length(trim(${table.assignmentStoragePath})) > 0
    AND ${table.assignmentStoragePath} LIKE 'birth-giving/assignments/' || ${table.id}::text || '/%'
    AND ${table.assignmentFileName} IS NOT NULL
    AND length(trim(${table.assignmentFileName})) > 0
    AND ${table.assignmentMimeType} IS NOT NULL
    AND length(trim(${table.assignmentMimeType})) > 0
    AND ${table.assignmentFileSize} > 0
    AND ${table.assignmentUploadedAt} IS NOT NULL
    AND ${table.assignmentUploadedByProfileId} IS NOT NULL
  ) OR (
    ${table.assignmentState} IN ('none', 'missing')
    AND ${table.assignmentStoragePath} IS NULL
    AND ${table.assignmentFileName} IS NULL
    AND ${table.assignmentMimeType} IS NULL
    AND ${table.assignmentFileSize} IS NULL
    AND ${table.assignmentUploadedAt} IS NULL
    AND ${table.assignmentUploadedByProfileId} IS NULL
  )`),
  check("birth_giving_events_removed_check", sql`(${table.removedAt} IS NULL) = (${table.removedByProfileId} IS NULL)`),
  pgPolicy("Community can view published BG events, organizers view drafts", {
    for: "select",
    to: ["authenticated"],
    using: sql`${ACTIVE_BIRTH_GIVING_CALLER} AND ${table.removedAt} IS NULL AND (${table.status} = 'published' OR current_profile_id() = ANY(${table.organizerProfileIds}))`,
  }),
]).enableRLS()

export const birthGivingTeams = pgTable("birth_giving_teams", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  eventId: uuid("event_id").notNull(),
  name: text().notNull(),
  isWinner: boolean("is_winner").default(false).notNull(),
  resultState: birthGivingTeamResultState("result_state").default("pending").notNull(),
  resultFiles: jsonb("result_files").default(sql`'[]'::jsonb`).notNull(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "string" }),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  unique("birth_giving_teams_event_id_id_key").on(table.eventId, table.id),
  uniqueIndex("birth_giving_teams_event_winner_idx").on(table.eventId).where(sql`${table.isWinner} AND ${table.cancelledAt} IS NULL`),
  index("birth_giving_teams_event_idx").on(table.eventId),
  foreignKey({ columns: [table.eventId], foreignColumns: [birthGivingEvents.id], name: "birth_giving_teams_event_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_teams_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_teams_updated_by_profile_id_fkey" }).onDelete("restrict"),
  check("birth_giving_teams_name_check", sql`length(trim(${table.name})) > 0`),
  check("birth_giving_teams_cancellation_check", sql`(
    ${table.cancelledAt} IS NULL AND ${table.cancellationReason} IS NULL
  ) OR (
    ${table.cancelledAt} IS NOT NULL
    AND ${table.cancellationReason} IS NOT NULL
    AND length(trim(${table.cancellationReason})) > 0
  )`),
  check("birth_giving_teams_result_check", sql`jsonb_typeof(${table.resultFiles}) = 'array' AND (
    (${table.resultState} = 'present' AND jsonb_array_length(${table.resultFiles}) > 0)
    OR (${table.resultState} IN ('pending', 'missing') AND jsonb_array_length(${table.resultFiles}) = 0)
  )`),
  pgPolicy("Community can view BG teams for accessible events", {
    for: "select",
    to: ["authenticated"],
    using: sql`${ACTIVE_BIRTH_GIVING_CALLER} AND ${BIRTH_GIVING_EVENT_VISIBLE(table.eventId)}`,
  }),
]).enableRLS()

export const birthGivingTeamMembers = pgTable("birth_giving_team_members", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  eventId: uuid("event_id").notNull(),
  teamId: uuid("team_id").notNull(),
  profileId: uuid("profile_id").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  reflectionContribution: text("reflection_contribution"),
  reflectionLearning: text("reflection_learning"),
  reflectionSubmittedAt: timestamp("reflection_submitted_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  unique("birth_giving_team_members_event_profile_key").on(table.eventId, table.profileId),
  unique("birth_giving_team_members_event_team_profile_key").on(table.eventId, table.teamId, table.profileId),
  index("birth_giving_team_members_team_idx").on(table.eventId, table.teamId),
  index("birth_giving_team_members_profile_idx").on(table.profileId),
  foreignKey({ columns: [table.eventId, table.teamId], foreignColumns: [birthGivingTeams.eventId, birthGivingTeams.id], name: "birth_giving_team_members_event_team_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "birth_giving_team_members_profile_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_members_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_members_updated_by_profile_id_fkey" }).onDelete("restrict"),
  check("birth_giving_team_members_reflection_check", sql`(
    ${table.reflectionContribution} IS NULL
    AND ${table.reflectionLearning} IS NULL
    AND ${table.reflectionSubmittedAt} IS NULL
  ) OR (
    ${table.reflectionContribution} IS NOT NULL
    AND length(trim(${table.reflectionContribution})) > 0
    AND ${table.reflectionLearning} IS NOT NULL
    AND length(trim(${table.reflectionLearning})) > 0
    AND ${table.reflectionSubmittedAt} IS NOT NULL
  )`),
  pgPolicy("Community can view BG memberships for accessible events", {
    for: "select",
    to: ["authenticated"],
    using: sql`${ACTIVE_BIRTH_GIVING_CALLER} AND ${BIRTH_GIVING_EVENT_VISIBLE(table.eventId)}`,
  }),
]).enableRLS()
