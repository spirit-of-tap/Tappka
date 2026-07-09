// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// To change the schema: edit here, then `npx drizzle-kit generate` and apply the migration.
import { pgTable, foreignKey, pgPolicy, uuid, text, jsonb, boolean, integer, timestamp, index, check, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"
import { books } from "./books"

export const essays = pgTable("essays", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authorProfileId: uuid("author_profile_id").notNull(),
	bookId: uuid("book_id"),
	title: text().notNull(),
	contentJson: jsonb("content_json").default({}).notNull(),
	contentText: text("content_text").default("").notNull(),
	published: boolean().default(true).notNull(),
	viewCount: integer("view_count").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	voteCount: integer("vote_count").default(0).notNull(),
	isPinned: boolean("is_pinned").default(false).notNull(),
	pinnedAt: timestamp("pinned_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("essays_author_idx").using("btree", table.authorProfileId.asc().nullsLast().op("uuid_ops")),
	index("essays_book_idx").using("btree", table.bookId.asc().nullsLast().op("uuid_ops")),
	index("essays_content_text_tsv_idx").using("gin", sql`to_tsvector('simple'::regconfig, content_text)`),
	index("essays_created_desc_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("essays_title_trgm_idx").using("gin", table.title.asc().nullsLast().op("gin_trgm_ops")),
	index("essays_vote_count_idx").using("btree", table.voteCount.desc().nullsFirst().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
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
	pgPolicy("Authors can create their own essays", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(author_profile_id = current_profile_id())`  }),
	pgPolicy("Authenticated users can view all essays", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Authors and admins can delete essays", { as: "permissive", for: "delete", to: ["authenticated"] }),
	pgPolicy("Authors can update their own essays", { as: "permissive", for: "update", to: ["authenticated"] }),
]);

export const essayComments = pgTable("essay_comments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	essayId: uuid("essay_id").notNull(),
	authorProfileId: uuid("author_profile_id").notNull(),
	body: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isLindaNudge: boolean("is_linda_nudge").default(false).notNull(),
	nudgeStatus: text("nudge_status"),
}, (table) => [
	index("essay_comments_author_idx").using("btree", table.authorProfileId.asc().nullsLast().op("uuid_ops")),
	index("essay_comments_essay_idx").using("btree", table.essayId.asc().nullsLast().op("uuid_ops")),
	index("essay_comments_open_linda_nudge_idx").using("btree", table.essayId.asc().nullsLast().op("uuid_ops")).where(sql`(is_linda_nudge AND (nudge_status = 'open'::text))`),
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
	pgPolicy("Authors and admins can delete essay comments", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`((author_profile_id = current_profile_id()) OR is_admin())` }),
	pgPolicy("Authors can update their own essay comments", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Authenticated users can add essay comments", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Authenticated users can view essay comments", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("essay_comments_body_check", sql`(char_length(body) >= 1) AND (char_length(body) <= 4000)`),
	check("essay_comments_nudge_status_check", sql`(nudge_status IS NULL) OR (nudge_status = ANY (ARRAY['open'::text, 'resolved'::text]))`),
]);

export const essayVotes = pgTable("essay_votes", {
	essayId: uuid("essay_id").notNull(),
	voterProfileId: uuid("voter_profile_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
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
	pgPolicy("Users can vote (not own essays)", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`((voter_profile_id = current_profile_id()) AND (NOT (essay_id IN ( SELECT essays.id
   FROM essays
  WHERE (essays.author_profile_id = current_profile_id())))))`  }),
	pgPolicy("Authenticated users can view votes", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Users can remove own votes", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const essayCoachReads = pgTable("essay_coach_reads", {
	essayId: uuid("essay_id").notNull(),
	coachProfileId: uuid("coach_profile_id").notNull(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
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
	pgPolicy("Coaches remove own reads", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(coach_profile_id = current_profile_id())` }),
	pgPolicy("Coaches mark own reads within their team", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Coach sees own reads; author sees reads of own essays", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const essayViews = pgTable("essay_views", {
	essayId: uuid("essay_id").notNull(),
	viewerProfileId: uuid("viewer_profile_id").notNull(),
	firstViewedAt: timestamp("first_viewed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastViewedAt: timestamp("last_viewed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
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
	primaryKey({ columns: [table.essayId, table.viewerProfileId], name: "essay_views_pkey"}),
	pgPolicy("No direct inserts to essay_views", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`false`  }),
	pgPolicy("Authors see all viewers; others see own row", { as: "permissive", for: "select", to: ["authenticated"] }),
]);
