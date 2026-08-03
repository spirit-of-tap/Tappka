// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { pgTable, foreignKey, pgPolicy, uuid, text, numeric, integer, boolean, timestamp, index, unique, check, pgEnum, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const bookSource = pgEnum("book_source", ['manual', 'google_books', 'open_library'])
export const bookListStatus = pgEnum("book_list_status", ['processing', 'shortlist', 'longlist', 'archived'])

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
	listStatus: bookListStatus("list_status").default('processing').notNull(),
	listStatusChangedAt: timestamp("list_status_changed_at", { withTimezone: true, mode: 'string' }),
	listStatusChangedByProfileId: uuid("list_status_changed_by_profile_id"),
	listStatusReason: text("list_status_reason"),
	highlightCategoryId: uuid("highlight_category_id"),
	isRocketModel: boolean("is_rocket_model").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("books_created_by_idx").using("btree", table.createdByProfileId.asc().nullsLast().op("uuid_ops")),
	index("books_author_trgm_idx").using("gin", table.author.asc().nullsLast().op("gin_trgm_ops")),
	index("books_created_desc_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("books_isbn_13_idx").using("btree", table.isbn13.asc().nullsLast().op("text_ops")).where(sql`(isbn_13 IS NOT NULL)`),
	index("books_list_status_idx").using("btree", table.listStatus.asc().nullsLast().op("enum_ops")),
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
			columns: [table.listStatusChangedByProfileId],
			foreignColumns: [profiles.id],
			name: "books_list_status_changed_by_profile_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.highlightCategoryId],
			foreignColumns: [highlightCategories.id],
			name: "books_highlight_category_id_fkey"
		}).onDelete("set null"),
	// ISBN identifies an edition, not a literary work — no UNIQUE constraint

	pgPolicy("Coaches and admins can delete books", { as: "permissive", for: "delete", to: ["public"], using: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can update books", { as: "permissive", for: "update", to: ["authenticated"], using: sql`is_coach_or_admin()`, withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Authenticated users can add books", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(created_by_profile_id = current_profile_id())` }),
	pgPolicy("Authenticated users can view all books", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	check("books_book_points_check", sql`(book_points IS NULL) OR ((book_points >= (0)::numeric) AND (book_points <= (3)::numeric))`),
	// Archived books are not eligible for points — force book_points to 0.
	check("books_archived_points_check", sql`(list_status <> 'archived') OR (book_points = (0)::numeric)`),
]).enableRLS();

export const highlightCategories = pgTable("highlight_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "highlight_categories_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "highlight_categories_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Authenticated users can view highlight categories", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Coaches and admins can add highlight categories", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can update highlight categories", { as: "permissive", for: "update", to: ["authenticated"], using: sql`is_coach_or_admin()`, withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can delete highlight categories", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`is_coach_or_admin()` }),
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

export const libraryBooks = pgTable("library_books", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	bookId: uuid("book_id").notNull(),
	isbn13: text("isbn_13"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("library_books_book_id_idx").using("btree", table.bookId.asc().nullsLast().op("uuid_ops")),
	index("library_books_isbn_13_idx").using("btree", table.isbn13.asc().nullsLast().op("text_ops")).where(sql`(isbn_13 IS NOT NULL)`),
	foreignKey({
			columns: [table.bookId],
			foreignColumns: [books.id],
			name: "library_books_book_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "library_books_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "library_books_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Authenticated users can view library books", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Coaches and admins can add library books", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can update library books", { as: "permissive", for: "update", to: ["authenticated"], using: sql`is_coach_or_admin()`, withCheck: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can delete library books", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`is_coach_or_admin()` }),
]).enableRLS();

export const bookLoans = pgTable("book_loans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	libraryBookId: uuid("library_book_id").notNull(),
	borrowerId: uuid("borrower_id").notNull(),
	borrowedAt: timestamp("borrowed_at", { withTimezone: true, mode: 'string' }).notNull(),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }).notNull(),
	returnedAt: timestamp("returned_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("book_loans_library_book_id_idx").using("btree", table.libraryBookId.asc().nullsLast().op("uuid_ops")),
	index("book_loans_borrower_id_idx").using("btree", table.borrowerId.asc().nullsLast().op("uuid_ops")),
	index("book_loans_active_idx").using("btree", table.libraryBookId.asc().nullsLast().op("uuid_ops")).where(sql`(returned_at IS NULL)`),
	foreignKey({
			columns: [table.libraryBookId],
			foreignColumns: [libraryBooks.id],
			name: "book_loans_library_book_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.borrowerId],
			foreignColumns: [profiles.id],
			name: "book_loans_borrower_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Authenticated users can view loans", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Users can borrow for themselves", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(borrower_id = current_profile_id())` }),
	pgPolicy("Borrower can return their own loan", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(borrower_id = current_profile_id())`, withCheck: sql`(borrower_id = current_profile_id())` }),
]).enableRLS();
