import { pgTable, foreignKey, pgPolicy, uuid, text, smallint, numeric, integer, timestamp, index, unique, check, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"
import { teams } from "./teams"

export const bookSource = pgEnum("book_source", ['manual', 'google_books', 'open_library'])
export const bookStatus = pgEnum("book_status", ['pending', 'approved', 'rejected'])

export const books = pgTable("books", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	author: text().notNull(),
	isbn13: text("isbn_13"),
	description: text(),
	coverPath: text("cover_path"),
	tags: text().array().default([""]).notNull(),
	suggestedPoints: smallint("suggested_points").default(1).notNull(),
	bookPoints: numeric("book_points", { precision: 5, scale:  2 }).default('0').notNull(),
	status: bookStatus().default('pending').notNull(),
	addedByProfileId: uuid("added_by_profile_id").notNull(),
	approvedByProfileId: uuid("approved_by_profile_id"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	source: bookSource().default('manual').notNull(),
	externalId: text("external_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	pageCount: integer("page_count"),
	previewLink: text("preview_link"),
	aiBookPoints: smallint("ai_book_points"),
	legacyBookPoints: numeric("legacy_book_points", { precision: 5, scale:  2 }),
	aiReason: text("ai_reason"),
}, (table) => [
	index("books_added_by_idx").using("btree", table.addedByProfileId.asc().nullsLast().op("uuid_ops")),
	index("books_author_trgm_idx").using("gin", table.author.asc().nullsLast().op("gin_trgm_ops")),
	index("books_created_desc_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("books_isbn_13_idx").using("btree", table.isbn13.asc().nullsLast().op("text_ops")).where(sql`(isbn_13 IS NOT NULL)`),
	index("books_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("books_title_trgm_idx").using("gin", table.title.asc().nullsLast().op("gin_trgm_ops")),
	foreignKey({
			columns: [table.addedByProfileId],
			foreignColumns: [profiles.id],
			name: "books_added_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.approvedByProfileId],
			foreignColumns: [profiles.id],
			name: "books_approved_by_profile_id_fkey"
		}).onDelete("set null"),
	unique("books_isbn_13_key").on(table.isbn13),
	pgPolicy("Coaches and admins can delete books", { as: "permissive", for: "delete", to: ["public"], using: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can update books", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Authenticated users can add books", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Authenticated users can view all books", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("books_suggested_points_check", sql`(suggested_points >= 0) AND (suggested_points <= 3)`),
	check("books_book_points_check", sql`(book_points >= (0)::numeric) AND (book_points <= (3)::numeric)`),
]);

export const bookComments = pgTable("book_comments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	bookId: uuid("book_id").notNull(),
	authorProfileId: uuid("author_profile_id").notNull(),
	body: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("book_comments_author_idx").using("btree", table.authorProfileId.asc().nullsLast().op("uuid_ops")),
	index("book_comments_book_idx").using("btree", table.bookId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.bookId],
			foreignColumns: [books.id],
			name: "book_comments_book_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.authorProfileId],
			foreignColumns: [profiles.id],
			name: "book_comments_author_profile_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Authors and admins can delete book comments", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`((author_profile_id = current_profile_id()) OR is_admin())` }),
	pgPolicy("Authors can update their own book comments", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Authenticated users can add book comments", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Authenticated users can view book comments", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("book_comments_body_check", sql`(char_length(body) >= 1) AND (char_length(body) <= 4000)`),
]);

export const teamReadingLists = pgTable("team_reading_lists", {
	id: uuid().defaultRandom().notNull(),
	teamId: uuid("team_id").notNull(),
	title: text().notNull(),
	month: text(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("team_reading_lists_team_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_reading_lists_team_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "team_reading_lists_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Team members can delete their lists", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(team_id = ( SELECT profiles.team_id
   FROM profiles
  WHERE (profiles.id = current_profile_id())))` }),
	pgPolicy("Team members can create lists", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Authenticated users can view team lists", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Team members can update their lists", { as: "permissive", for: "update", to: ["authenticated"] }),
]);

export const teamReadingListBooks = pgTable("team_reading_list_books", {
	listId: uuid("list_id").notNull(),
	bookId: uuid("book_id").notNull(),
	position: smallint().default(0).notNull(),
	note: text(),
}, (table) => [
	index("team_reading_list_books_list_idx").using("btree", table.listId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.listId],
			foreignColumns: [teamReadingLists.id],
			name: "team_reading_list_books_list_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.bookId],
			foreignColumns: [books.id],
			name: "team_reading_list_books_book_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Authenticated users can view list books", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Team members can remove list books", { as: "permissive", for: "delete", to: ["authenticated"] }),
	pgPolicy("Team members can manage list books", { as: "permissive", for: "insert", to: ["authenticated"] }),
]);
