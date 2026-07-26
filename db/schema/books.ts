// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { pgTable, foreignKey, pgPolicy, uuid, text, numeric, integer, timestamp, index, unique, check, pgEnum, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const bookSource = pgEnum("book_source", ['manual', 'google_books', 'open_library'])
export const bookStatus = pgEnum("book_status", ['pending', 'approved', 'rejected'])

export const tags = pgTable("tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	unique("tags_name_key").on(table.name),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "tags_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "tags_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Authenticated users can view tags", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Coaches and admins can add tags", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can update tags", { as: "permissive", for: "update", to: ["authenticated"], using: sql`is_coach_or_admin()`, withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can delete tags", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`is_coach_or_admin()` }),
]).enableRLS();

export const books = pgTable("books", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	titleCs: text("title_cs").notNull(),
	titleEn: text("title_en"),
	author: text().notNull(),
	isbn13: text("isbn_13"),
	description: text(),
	googleBooksCoverUrl: text("google_books_cover_url"),
	bookPoints: numeric("book_points", { precision: 3, scale: 2 }),
	pageCount: integer("page_count"),
	previewLink: text("preview_link"),
	source: bookSource().default('manual').notNull(),
	externalId: text("external_id"),
	status: bookStatus().default('pending').notNull(),
	statusChangedAt: timestamp("status_changed_at", { withTimezone: true, mode: 'string' }),
	statusChangedByProfileId: uuid("status_changed_by_profile_id"),
	statusReason: text("status_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("books_created_by_idx").using("btree", table.createdByProfileId.asc().nullsLast().op("uuid_ops")),
	index("books_author_trgm_idx").using("gin", table.author.asc().nullsLast().op("gin_trgm_ops")),
	index("books_created_desc_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("books_isbn_13_idx").using("btree", table.isbn13.asc().nullsLast().op("text_ops")).where(sql`(isbn_13 IS NOT NULL)`),
	index("books_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("books_title_cs_trgm_idx").using("gin", table.titleCs.asc().nullsLast().op("gin_trgm_ops")),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "books_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "books_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.statusChangedByProfileId],
			foreignColumns: [profiles.id],
			name: "books_status_changed_by_profile_id_fkey"
		}).onDelete("set null"),
	unique("books_isbn_13_key").on(table.isbn13),
	pgPolicy("Coaches and admins can delete books", { as: "permissive", for: "delete", to: ["public"], using: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can update books", { as: "permissive", for: "update", to: ["authenticated"], using: sql`is_coach_or_admin()`, withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Authenticated users can add books", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(created_by_profile_id = current_profile_id())` }),
	pgPolicy("Authenticated users can view all books", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	check("books_book_points_check", sql`(book_points IS NULL) OR ((book_points >= (0)::numeric) AND (book_points <= (3)::numeric))`),
]).enableRLS();

export const bookTags = pgTable("book_tags", {
	bookId: uuid("book_id").notNull(),
	tagId: uuid("tag_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("book_tags_tag_idx").using("btree", table.tagId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.bookId],
			foreignColumns: [books.id],
			name: "book_tags_book_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tags.id],
			name: "book_tags_tag_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "book_tags_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "book_tags_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.bookId, table.tagId], name: "book_tags_pkey" }),
	pgPolicy("Authenticated users can view book tags", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Authenticated users can assign book tags", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(created_by_profile_id = current_profile_id())` }),
	pgPolicy("Coaches and admins can update book tags", { as: "permissive", for: "update", to: ["authenticated"], using: sql`is_coach_or_admin()`, withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can remove book tags", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`is_coach_or_admin()` }),
]).enableRLS();

export const bookComments = pgTable("book_comments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	bookId: uuid("book_id").notNull(),
	authorProfileId: uuid("author_profile_id").notNull(),
	body: text().notNull(),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
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
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "book_comments_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "book_comments_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Authors and admins can delete book comments", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`((author_profile_id = current_profile_id()) OR is_admin())` }),
	pgPolicy("Authors can update their own book comments", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(author_profile_id = current_profile_id())`, withCheck: sql`(author_profile_id = current_profile_id())` }),
	pgPolicy("Authenticated users can add book comments", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(author_profile_id = current_profile_id())` }),
	pgPolicy("Authenticated users can view book comments", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	check("book_comments_body_check", sql`(char_length(body) >= 1) AND (char_length(body) <= 4000)`),
]).enableRLS();
