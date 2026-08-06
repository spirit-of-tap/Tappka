// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { pgTable, foreignKey, pgPolicy, uuid, text, jsonb, integer, timestamp, index, check, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"
import { books } from "./books"

export const essays = pgTable("essays", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	externalId: text("external_id"),
	authorProfileId: uuid("author_profile_id").notNull(),
	bookId: uuid("book_id"),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	pinnedAt: timestamp("pinned_at", { withTimezone: true, mode: 'string' }),
	pinnedByProfileId: uuid("pinned_by_profile_id"),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("essays_author_idx").using("btree", table.authorProfileId.asc().nullsLast().op("uuid_ops")),
	index("essays_book_idx").using("btree", table.bookId.asc().nullsLast().op("uuid_ops")),
	index("essays_created_desc_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.authorProfileId],
			foreignColumns: [profiles.id],
			name: "essays_author_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.bookId],
			foreignColumns: [books.id],
			name: "essays_book_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.pinnedByProfileId],
			foreignColumns: [profiles.id],
			name: "essays_pinned_by_profile_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "essays_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "essays_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Authors can create their own essays", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(author_profile_id = current_profile_id())` }),
	pgPolicy("Authenticated users can view all essays", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Authors and admins can delete essays", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`((author_profile_id = current_profile_id()) OR is_admin())` }),
	pgPolicy("Authors can update their own essays", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(author_profile_id = current_profile_id())`, withCheck: sql`(author_profile_id = current_profile_id())` }),
]).enableRLS();

export const essayRevisions = pgTable("essay_revisions", {
	essayId: uuid("essay_id").notNull(),
	revisionNo: integer("revision_no").notNull(),
	title: text().notNull(),
	contentJson: jsonb("content_json").notNull(),
	invalidSince: timestamp("invalid_since", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.essayId],
			foreignColumns: [essays.id],
			name: "essay_revisions_essay_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "essay_revisions_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "essay_revisions_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.essayId, table.revisionNo], name: "essay_revisions_pkey" }),
	pgPolicy("Authenticated users can view essay revisions", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Authors can create essay revisions", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(created_by_profile_id = current_profile_id())` }),
	pgPolicy("Essay revisions cannot be updated", { as: "permissive", for: "update", to: ["authenticated"], using: sql`false` }),
	pgPolicy("Essay revisions cannot be deleted", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`false` }),
]).enableRLS();

export const essayComments = pgTable("essay_comments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	essayId: uuid("essay_id").notNull(),
	authorProfileId: uuid("author_profile_id").notNull(),
	parentId: uuid("parent_id"),
	body: text().notNull(),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("essay_comments_author_idx").using("btree", table.authorProfileId.asc().nullsLast().op("uuid_ops")),
	index("essay_comments_essay_idx").using("btree", table.essayId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.essayId],
			foreignColumns: [essays.id],
			name: "essay_comments_essay_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.authorProfileId],
			foreignColumns: [profiles.id],
			name: "essay_comments_author_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "essay_comments_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "essay_comments_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "essay_comments_parent_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Authors and admins can delete essay comments", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`((author_profile_id = current_profile_id()) OR is_admin())` }),
	pgPolicy("Authors can update their own essay comments", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(author_profile_id = current_profile_id())`, withCheck: sql`(author_profile_id = current_profile_id())` }),
	pgPolicy("Authenticated users can add essay comments", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(author_profile_id = current_profile_id())` }),
	pgPolicy("Authenticated users can view essay comments", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	check("essay_comments_body_check", sql`(char_length(body) >= 1) AND (char_length(body) <= 4000)`),
]).enableRLS();

export const essayVotes = pgTable("essay_votes", {
	essayId: uuid("essay_id").notNull(),
	voterProfileId: uuid("voter_profile_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("essay_votes_voter_idx").using("btree", table.voterProfileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.essayId],
			foreignColumns: [essays.id],
			name: "essay_votes_essay_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.voterProfileId],
			foreignColumns: [profiles.id],
			name: "essay_votes_voter_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "essay_votes_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "essay_votes_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.essayId, table.voterProfileId], name: "essay_votes_pkey"}),
	pgPolicy("Users can vote (not own essays)", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`((voter_profile_id = current_profile_id()) AND (NOT (essay_id IN ( SELECT essays.id
   FROM essays
  WHERE (essays.author_profile_id = current_profile_id())))))` }),
	pgPolicy("Authenticated users can view votes", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Users can remove own votes", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(voter_profile_id = current_profile_id())` }),
]).enableRLS();

export const essayCoachReads = pgTable("essay_coach_reads", {
	essayId: uuid("essay_id").notNull(),
	coachProfileId: uuid("coach_profile_id").notNull(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("essay_coach_reads_coach_idx").using("btree", table.coachProfileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.essayId],
			foreignColumns: [essays.id],
			name: "essay_coach_reads_essay_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.coachProfileId],
			foreignColumns: [profiles.id],
			name: "essay_coach_reads_coach_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "essay_coach_reads_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "essay_coach_reads_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.essayId, table.coachProfileId], name: "essay_coach_reads_pkey"}),
	pgPolicy("Coaches remove own reads", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(coach_profile_id = current_profile_id())` }),
	pgPolicy("Coaches mark own reads within their team", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`((coach_profile_id = current_profile_id()) AND coach_can_review_essay(essay_id))` }),
	pgPolicy("Coach sees own reads; author sees reads of own essays", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((coach_profile_id = current_profile_id()) OR (EXISTS ( SELECT 1
   FROM essays e
  WHERE ((e.id = essay_coach_reads.essay_id) AND (e.author_profile_id = current_profile_id())))))` }),
]).enableRLS();

export const essayViews = pgTable("essay_views", {
	essayId: uuid("essay_id").notNull(),
	viewerProfileId: uuid("viewer_profile_id").notNull(),
	firstViewedAt: timestamp("first_viewed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastViewedAt: timestamp("last_viewed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("essay_views_viewer_idx").using("btree", table.viewerProfileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.essayId],
			foreignColumns: [essays.id],
			name: "essay_views_essay_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.viewerProfileId],
			foreignColumns: [profiles.id],
			name: "essay_views_viewer_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "essay_views_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "essay_views_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.essayId, table.viewerProfileId], name: "essay_views_pkey"}),
	pgPolicy("No direct inserts to essay_views", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`false` }),
	pgPolicy("Authors see all viewers; others see own row", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((viewer_profile_id = current_profile_id()) OR (EXISTS ( SELECT 1
   FROM essays e
  WHERE ((e.id = essay_views.essay_id) AND (e.author_profile_id = current_profile_id())))))` }),
]).enableRLS();
