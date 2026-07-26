// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
// Keep the view body in sync if a migration alters it, or the next generate emits a spurious CREATE OR REPLACE VIEW.
import { pgView, uuid, text, numeric, timestamp, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { bookSource, bookStatus } from "./books"

export const booksWithEssayCount = pgView("books_with_essay_count", {
	id: uuid(),
	titleCs: text("title_cs"),
	titleEn: text("title_en"),
	author: text(),
	isbn13: text("isbn_13"),
	description: text(),
	googleBooksCoverUrl: text("google_books_cover_url"),
	bookPoints: numeric("book_points", { precision: 3, scale: 2 }),
	pageCount: integer("page_count"),
	previewLink: text("preview_link"),
	source: bookSource(),
	externalId: text("external_id"),
	status: bookStatus(),
	statusChangedAt: timestamp("status_changed_at", { withTimezone: true, mode: 'string' }),
	statusChangedByProfileId: uuid("status_changed_by_profile_id"),
	statusReason: text("status_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdByProfileId: uuid("created_by_profile_id"),
	updatedByProfileId: uuid("updated_by_profile_id"),
	essayCount: integer("essay_count"),
}).as(sql`SELECT b.id, b.title_cs, b.title_en, b.author, b.isbn_13, b.description, b.google_books_cover_url, b.book_points, b.page_count, b.preview_link, b.source, b.external_id, b.status, b.status_changed_at, b.status_changed_by_profile_id, b.status_reason, b.created_at, b.updated_at, b.created_by_profile_id, b.updated_by_profile_id, COALESCE(ec.essay_count, 0) AS essay_count FROM books b LEFT JOIN ( SELECT essays.book_id, count(*)::integer AS essay_count FROM essays WHERE essays.book_id IS NOT NULL GROUP BY essays.book_id) ec ON ec.book_id = b.id`);
