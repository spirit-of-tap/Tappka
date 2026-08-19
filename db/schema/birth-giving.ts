// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

import { profiles } from "./profiles"

const MINIMUM_TEAM_SIZE = 1

export const birthGivingDuration = pgEnum("birth_giving_duration", ["8h", "24h"])
export const birthGivingEventStatus = pgEnum("birth_giving_event_status", ["draft", "published"])
export const birthGivingAssignmentState = pgEnum("birth_giving_assignment_state", ["present", "missing"])
export const birthGivingTeamStatus = pgEnum("birth_giving_team_status", ["forming", "confirmed", "cancelled"])
export const birthGivingTeamResultState = pgEnum("birth_giving_team_result_state", ["pending", "present", "missing"])
export const birthGivingProposalDirection = pgEnum("birth_giving_proposal_direction", ["join_request", "invitation"])
export const birthGivingProposalState = pgEnum("birth_giving_proposal_state", ["pending", "accepted", "rejected", "cancelled", "expired"])
export const birthGivingEmailMessageType = pgEnum("birth_giving_email_message_type", ["assignment_release", "assignment_replacement"])
export const birthGivingDeliveryStatus = pgEnum("birth_giving_delivery_status", ["pending", "processing", "sent", "failed"])

const verifiedCommunity = sql`EXISTS (
  SELECT 1
  FROM users
  JOIN profiles caller_profile ON caller_profile.user_id = users.id
  WHERE users.auth_user_id = (SELECT auth.uid())
    AND users.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
    AND caller_profile.beta_access_granted_at IS NOT NULL
)`

const activeCaller = sql`EXISTS (
  SELECT 1
  FROM profiles caller_profile
  JOIN users caller_user ON caller_user.id = caller_profile.user_id
  WHERE caller_profile.id = current_profile_id()
    AND caller_user.verified_work_email IS NOT NULL
    AND caller_profile.access_removed_at IS NULL
    AND caller_profile.beta_access_granted_at IS NOT NULL
)`

export const birthGivingEvents = pgTable("birth_giving_events", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  normalizedName: text("normalized_name").notNull(),
  customer: text().notNull(),
  normalizedCustomer: text("normalized_customer").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "string" }).notNull(),
  duration: birthGivingDuration().notNull(),
  minimumTeamSize: integer("minimum_team_size").notNull(),
  maximumTeamSize: integer("maximum_team_size").notNull(),
  joiningOpen: boolean("joining_open").notNull(),
  status: birthGivingEventStatus().default("draft").notNull(),
  startProcessedAt: timestamp("start_processed_at", { withTimezone: true, mode: "string" }),
  startEmailsQueuedAt: timestamp("start_emails_queued_at", { withTimezone: true, mode: "string" }),
  removedAt: timestamp("removed_at", { withTimezone: true, mode: "string" }),
  removedByProfileId: uuid("removed_by_profile_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  unique("birth_giving_events_identity_key").on(table.normalizedName, table.normalizedCustomer, table.startsAt),
  index("birth_giving_events_status_starts_at_idx").on(table.status, table.startsAt),
  foreignKey({ columns: [table.removedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_events_removed_by_profile_id_fkey" }).onDelete("set null"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_events_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_events_updated_by_profile_id_fkey" }).onDelete("restrict"),
  check("birth_giving_events_name_check", sql`length(trim(name)) > 0 AND length(trim(normalized_name)) > 0`),
  check("birth_giving_events_customer_check", sql`length(trim(customer)) > 0 AND length(trim(normalized_customer)) > 0`),
  check("birth_giving_events_normalized_name_check", sql`normalized_name = lower(regexp_replace(trim(normalize(name, NFKC)), '[[:space:]]+', ' ', 'g'))`),
  check("birth_giving_events_normalized_customer_check", sql`normalized_customer = lower(regexp_replace(trim(normalize(customer, NFKC)), '[[:space:]]+', ' ', 'g'))`),
  check("birth_giving_events_team_sizes_check", sql`minimum_team_size >= ${sql.raw(String(MINIMUM_TEAM_SIZE))} AND maximum_team_size >= minimum_team_size`),
  check("birth_giving_events_removed_check", sql`(removed_at IS NULL) = (removed_by_profile_id IS NULL)`),
  pgPolicy("Verified community can view published BG events", { for: "select", to: ["authenticated"], using: sql`removed_at IS NULL AND can_view_birth_giving_event_organizers(id)` }),
  pgPolicy("Profiles can create BG event drafts", { for: "insert", to: ["authenticated"], withCheck: sql`false` }),
  pgPolicy("BG organizers can update events", { for: "update", to: ["authenticated"], using: sql`false`, withCheck: sql`false` }),
  pgPolicy("BG events cannot be directly deleted", { for: "delete", to: ["authenticated"], using: sql`false` }),
]).enableRLS()

export const birthGivingEventOrganizers = pgTable("birth_giving_event_organizers", {
  eventId: uuid("event_id").notNull(),
  profileId: uuid("profile_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  primaryKey({ columns: [table.eventId, table.profileId], name: "birth_giving_event_organizers_pkey" }),
  index("birth_giving_event_organizers_profile_idx").on(table.profileId),
  foreignKey({ columns: [table.eventId], foreignColumns: [birthGivingEvents.id], name: "birth_giving_event_organizers_event_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "birth_giving_event_organizers_profile_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_event_organizers_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_event_organizers_updated_by_profile_id_fkey" }).onDelete("restrict"),
  pgPolicy("BG organizers can view their organizer rows", { for: "select", to: ["authenticated"], using: sql`can_view_birth_giving_event_organizers(event_id)` }),
  pgPolicy("BG organizer changes use lifecycle RPCs", { for: "all", to: ["authenticated"], using: sql`false`, withCheck: sql`false` }),
]).enableRLS()

export const birthGivingAssignments = pgTable("birth_giving_assignments", {
  eventId: uuid("event_id").primaryKey().notNull(),
  state: birthGivingAssignmentState().notNull(),
  replacementId: uuid("replacement_id").defaultRandom().notNull(),
  storagePath: text("storage_path"),
  originalFileName: text("original_file_name"),
  mimeType: text("mime_type"),
  fileSize: bigint("file_size", { mode: "number" }),
  uploadedByProfileId: uuid("uploaded_by_profile_id"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  foreignKey({ columns: [table.eventId], foreignColumns: [birthGivingEvents.id], name: "birth_giving_assignments_event_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.uploadedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_assignments_uploaded_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_assignments_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_assignments_updated_by_profile_id_fkey" }).onDelete("restrict"),
  check("birth_giving_assignments_metadata_check", sql`(state = 'present' AND storage_path IS NOT NULL AND length(trim(storage_path)) > 0 AND original_file_name IS NOT NULL AND length(trim(original_file_name)) > 0 AND mime_type IS NOT NULL AND length(trim(mime_type)) > 0 AND file_size > 0 AND uploaded_by_profile_id IS NOT NULL AND uploaded_at IS NOT NULL) OR (state = 'missing' AND storage_path IS NULL AND original_file_name IS NULL AND mime_type IS NULL AND file_size IS NULL AND uploaded_by_profile_id IS NULL AND uploaded_at IS NULL)`),
  pgPolicy("Community can view released BG assignments", { for: "select", to: ["authenticated"], using: sql`EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_assignments.event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND e.starts_at <= now() AND ${verifiedCommunity}) OR (${activeCaller} AND EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))))` }),
  pgPolicy("BG organizers can insert assignments", { for: "insert", to: ["authenticated"], withCheck: sql`false` }),
  pgPolicy("BG organizers can update assignments", { for: "update", to: ["authenticated"], using: sql`false`, withCheck: sql`false` }),
  pgPolicy("BG assignments cannot be directly deleted", { for: "delete", to: ["authenticated"], using: sql`false` }),
]).enableRLS()

export const birthGivingTeams = pgTable("birth_giving_teams", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  eventId: uuid("event_id").notNull(),
  name: text().notNull(),
  status: birthGivingTeamStatus().default("forming").notNull(),
  resultState: birthGivingTeamResultState("result_state").default("pending").notNull(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "string" }),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  unique("birth_giving_teams_event_id_id_key").on(table.eventId, table.id),
  index("birth_giving_teams_event_idx").on(table.eventId),
  foreignKey({ columns: [table.eventId], foreignColumns: [birthGivingEvents.id], name: "birth_giving_teams_event_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_teams_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_teams_updated_by_profile_id_fkey" }).onDelete("restrict"),
  check("birth_giving_teams_name_check", sql`length(trim(name)) > 0`),
  check("birth_giving_teams_cancellation_check", sql`(status = 'cancelled' AND cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND length(trim(cancellation_reason)) > 0) OR (status <> 'cancelled' AND cancelled_at IS NULL AND cancellation_reason IS NULL)`),
  pgPolicy("Community can view published BG teams", { for: "select", to: ["authenticated"], using: sql`EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_teams.event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND ${verifiedCommunity}) OR (${activeCaller} AND EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))))` }),
  pgPolicy("BG organizers can insert teams", { for: "insert", to: ["authenticated"], withCheck: sql`false` }),
  pgPolicy("BG organizers can update teams", { for: "update", to: ["authenticated"], using: sql`false`, withCheck: sql`false` }),
  pgPolicy("BG teams cannot be directly deleted", { for: "delete", to: ["authenticated"], using: sql`false` }),
]).enableRLS()

export const birthGivingTeamMembers = pgTable("birth_giving_team_members", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  eventId: uuid("event_id").notNull(),
  teamId: uuid("team_id").notNull(),
  profileId: uuid("profile_id").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  frozenAt: timestamp("frozen_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  unique("birth_giving_team_members_event_profile_key").on(table.eventId, table.profileId),
  unique("birth_giving_team_members_event_team_profile_key").on(table.eventId, table.teamId, table.profileId),
  index("birth_giving_team_members_team_idx").on(table.eventId, table.teamId),
  foreignKey({ columns: [table.eventId, table.teamId], foreignColumns: [birthGivingTeams.eventId, birthGivingTeams.id], name: "birth_giving_team_members_event_team_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "birth_giving_team_members_profile_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_members_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_members_updated_by_profile_id_fkey" }).onDelete("restrict"),
  pgPolicy("Community can view published BG memberships", { for: "select", to: ["authenticated"], using: sql`EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_team_members.event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND ${verifiedCommunity}) OR (${activeCaller} AND EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))))` }),
  pgPolicy("BG membership changes use lifecycle RPCs", { for: "all", to: ["authenticated"], using: sql`false`, withCheck: sql`false` }),
]).enableRLS()

export const birthGivingTeamProposals = pgTable("birth_giving_team_proposals", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  eventId: uuid("event_id").notNull(),
  teamId: uuid("team_id").notNull(),
  candidateProfileId: uuid("candidate_profile_id").notNull(),
  initiatedByProfileId: uuid("initiated_by_profile_id").notNull(),
  direction: birthGivingProposalDirection().notNull(),
  state: birthGivingProposalState().default("pending").notNull(),
  resolvedByProfileId: uuid("resolved_by_profile_id"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  index("birth_giving_team_proposals_event_candidate_idx").on(table.eventId, table.candidateProfileId),
  index("birth_giving_team_proposals_team_state_idx").on(table.eventId, table.teamId, table.state),
  foreignKey({ columns: [table.eventId, table.teamId], foreignColumns: [birthGivingTeams.eventId, birthGivingTeams.id], name: "birth_giving_team_proposals_event_team_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.candidateProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_proposals_candidate_profile_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.initiatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_proposals_initiated_by_profile_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.resolvedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_proposals_resolved_by_profile_id_fkey" }).onDelete("set null"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_proposals_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_proposals_updated_by_profile_id_fkey" }).onDelete("restrict"),
  check("birth_giving_team_proposals_direction_check", sql`(direction = 'join_request' AND candidate_profile_id = initiated_by_profile_id) OR (direction = 'invitation' AND candidate_profile_id <> initiated_by_profile_id)`),
  check("birth_giving_team_proposals_resolution_check", sql`(state = 'pending' AND resolved_by_profile_id IS NULL AND resolved_at IS NULL) OR (state <> 'pending' AND resolved_at IS NOT NULL)`),
  pgPolicy("Profiles can view relevant BG proposals", { for: "select", to: ["authenticated"], using: sql`${activeCaller} AND (candidate_profile_id = current_profile_id() OR initiated_by_profile_id = current_profile_id() OR EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = birth_giving_team_proposals.event_id AND o.profile_id = current_profile_id()) OR EXISTS (SELECT 1 FROM birth_giving_team_members m WHERE m.event_id = birth_giving_team_proposals.event_id AND m.team_id = birth_giving_team_proposals.team_id AND m.profile_id = current_profile_id()))` }),
  pgPolicy("BG proposal changes use lifecycle RPCs", { for: "all", to: ["authenticated"], using: sql`false`, withCheck: sql`false` }),
]).enableRLS()

export const birthGivingLookingForTeam = pgTable("birth_giving_looking_for_team", {
  eventId: uuid("event_id").notNull(),
  profileId: uuid("profile_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  primaryKey({ columns: [table.eventId, table.profileId], name: "birth_giving_looking_for_team_pkey" }),
  index("birth_giving_looking_for_team_profile_idx").on(table.profileId),
  foreignKey({ columns: [table.eventId], foreignColumns: [birthGivingEvents.id], name: "birth_giving_looking_for_team_event_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "birth_giving_looking_for_team_profile_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_looking_for_team_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_looking_for_team_updated_by_profile_id_fkey" }).onDelete("restrict"),
  pgPolicy("Community can view BG team searches", { for: "select", to: ["authenticated"], using: sql`${verifiedCommunity} AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_looking_for_team.event_id AND e.status = 'published' AND e.removed_at IS NULL)` }),
  pgPolicy("Profiles can start their own BG team search", { for: "insert", to: ["authenticated"], withCheck: sql`profile_id = current_profile_id() AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id() AND ${activeCaller} AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_looking_for_team.event_id AND e.status = 'published' AND e.joining_open AND now() < e.starts_at AND e.removed_at IS NULL) AND NOT EXISTS (SELECT 1 FROM birth_giving_team_members m WHERE m.event_id = birth_giving_looking_for_team.event_id AND m.profile_id = current_profile_id())` }),
  pgPolicy("Profiles can update their own BG team search", { for: "update", to: ["authenticated"], using: sql`profile_id = current_profile_id() AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id() AND ${activeCaller} AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_looking_for_team.event_id AND e.status = 'published' AND e.joining_open AND now() < e.starts_at AND e.removed_at IS NULL) AND NOT EXISTS (SELECT 1 FROM birth_giving_team_members m WHERE m.event_id = birth_giving_looking_for_team.event_id AND m.profile_id = current_profile_id())`, withCheck: sql`profile_id = current_profile_id() AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id() AND ${activeCaller} AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_looking_for_team.event_id AND e.status = 'published' AND e.joining_open AND now() < e.starts_at AND e.removed_at IS NULL) AND NOT EXISTS (SELECT 1 FROM birth_giving_team_members m WHERE m.event_id = birth_giving_looking_for_team.event_id AND m.profile_id = current_profile_id())` }),
  pgPolicy("Profiles can stop their own BG team search", { for: "delete", to: ["authenticated"], using: sql`${activeCaller} AND profile_id = current_profile_id()` }),
]).enableRLS()

export const birthGivingTeamResultFiles = pgTable("birth_giving_team_result_files", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  eventId: uuid("event_id").notNull(),
  teamId: uuid("team_id").notNull(),
  storagePath: text("storage_path").notNull(),
  originalFileName: text("original_file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  uploadedByProfileId: uuid("uploaded_by_profile_id").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  removedAt: timestamp("removed_at", { withTimezone: true, mode: "string" }),
  removedByProfileId: uuid("removed_by_profile_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  unique("birth_giving_team_result_files_storage_path_key").on(table.storagePath),
  index("birth_giving_team_result_files_team_idx").on(table.eventId, table.teamId),
  foreignKey({ columns: [table.eventId, table.teamId], foreignColumns: [birthGivingTeams.eventId, birthGivingTeams.id], name: "birth_giving_team_result_files_event_team_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.uploadedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_result_files_uploaded_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.removedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_result_files_removed_by_profile_id_fkey" }).onDelete("set null"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_result_files_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_team_result_files_updated_by_profile_id_fkey" }).onDelete("restrict"),
  check("birth_giving_team_result_files_metadata_check", sql`length(trim(storage_path)) > 0 AND length(trim(original_file_name)) > 0 AND length(trim(mime_type)) > 0 AND file_size > 0`),
  check("birth_giving_team_result_files_removed_check", sql`(removed_at IS NULL) = (removed_by_profile_id IS NULL)`),
  pgPolicy("Community can view published BG result files", { for: "select", to: ["authenticated"], using: sql`birth_giving_team_result_files.removed_at IS NULL AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_team_result_files.event_id AND e.removed_at IS NULL AND ((e.status = 'published' AND ${verifiedCommunity}) OR (${activeCaller} AND EXISTS (SELECT 1 FROM birth_giving_event_organizers o WHERE o.event_id = e.id AND o.profile_id = current_profile_id()))))` }),
  pgPolicy("BG members and organizers can insert result files", { for: "insert", to: ["authenticated"], withCheck: sql`false` }),
  pgPolicy("BG members and organizers can update result files", { for: "update", to: ["authenticated"], using: sql`false`, withCheck: sql`false` }),
  pgPolicy("BG result files cannot be directly deleted", { for: "delete", to: ["authenticated"], using: sql`false` }),
]).enableRLS()

export const birthGivingStorageCleanupClaims = pgTable("birth_giving_storage_cleanup_claims", {
  storagePath: text("storage_path").primaryKey().notNull(),
  claimId: uuid("claim_id").defaultRandom().notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  attemptCount: integer("attempt_count").default(1).notNull(),
}, (table) => [
  unique("birth_giving_storage_cleanup_claims_claim_id_key").on(table.claimId),
  check("birth_giving_storage_cleanup_claims_attempt_count_check", sql`attempt_count >= 1`),
  pgPolicy("BG storage cleanup claims are private", { for: "all", to: ["authenticated"], using: sql`false`, withCheck: sql`false` }),
]).enableRLS()

export const birthGivingReflections = pgTable("birth_giving_reflections", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  eventId: uuid("event_id").notNull(),
  profileId: uuid("profile_id").notNull(),
  contribution: text().notNull(),
  learning: text().notNull(),
  removedAt: timestamp("removed_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  unique("birth_giving_reflections_event_profile_key").on(table.eventId, table.profileId),
  index("birth_giving_reflections_profile_idx").on(table.profileId),
  foreignKey({ columns: [table.eventId, table.profileId], foreignColumns: [birthGivingTeamMembers.eventId, birthGivingTeamMembers.profileId], name: "birth_giving_reflections_participant_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_reflections_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_reflections_updated_by_profile_id_fkey" }).onDelete("restrict"),
  check("birth_giving_reflections_content_check", sql`length(trim(contribution)) > 0 AND length(trim(learning)) > 0`),
  pgPolicy("Community can view published BG reflections", { for: "select", to: ["authenticated"], using: sql`removed_at IS NULL AND ${verifiedCommunity} AND EXISTS (SELECT 1 FROM birth_giving_events e WHERE e.id = birth_giving_reflections.event_id AND e.status = 'published' AND e.removed_at IS NULL)` }),
  pgPolicy("Participants can create their BG reflections", { for: "insert", to: ["authenticated"], withCheck: sql`false` }),
  pgPolicy("Participants can update their BG reflections", { for: "update", to: ["authenticated"], using: sql`false`, withCheck: sql`false` }),
  pgPolicy("BG reflections cannot be directly deleted", { for: "delete", to: ["authenticated"], using: sql`false` }),
]).enableRLS()

export const birthGivingEmailDeliveries = pgTable("birth_giving_email_deliveries", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  eventId: uuid("event_id").notNull(),
  profileId: uuid("profile_id").notNull(),
  messageType: birthGivingEmailMessageType("message_type").notNull(),
  replacementId: uuid("replacement_id"),
  recipientEmail: text("recipient_email").notNull(),
  status: birthGivingDeliveryStatus().default("pending").notNull(),
  attemptCount: integer("attempt_count").default(0).notNull(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  processingStartedAt: timestamp("processing_started_at", { withTimezone: true, mode: "string" }),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
  providerMessageId: text("provider_message_id"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  unique("birth_giving_email_deliveries_dedupe_key").on(table.eventId, table.profileId, table.messageType, table.replacementId).nullsNotDistinct(),
  index("birth_giving_email_deliveries_pending_idx").on(table.status, table.nextAttemptAt),
  foreignKey({ columns: [table.eventId], foreignColumns: [birthGivingEvents.id], name: "birth_giving_email_deliveries_event_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "birth_giving_email_deliveries_profile_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.eventId, table.profileId], foreignColumns: [birthGivingTeamMembers.eventId, birthGivingTeamMembers.profileId], name: "birth_giving_email_deliveries_participant_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "birth_giving_email_deliveries_created_by_profile_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "birth_giving_email_deliveries_updated_by_profile_id_fkey" }).onDelete("restrict"),
  check("birth_giving_email_deliveries_message_check", sql`(message_type = 'assignment_release' AND replacement_id IS NULL) OR (message_type = 'assignment_replacement' AND replacement_id IS NOT NULL)`),
  check("birth_giving_email_deliveries_attempt_count_check", sql`attempt_count >= 0`),
  check("birth_giving_email_deliveries_recipient_check", sql`length(trim(recipient_email)) > 0`),
  pgPolicy("BG delivery outbox is private", { for: "all", to: ["authenticated"], using: sql`false`, withCheck: sql`false` }),
]).enableRLS()
