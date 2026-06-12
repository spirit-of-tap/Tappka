import { pgView, uuid, text, smallint, numeric, timestamp, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { bookSource, bookStatus } from "./books"

export const booksWithEssayCount = pgView("books_with_essay_count", {	id: uuid(),
	title: text(),
	author: text(),
	isbn13: text("isbn_13"),
	description: text(),
	coverPath: text("cover_path"),
	tags: text(),
	suggestedPoints: smallint("suggested_points"),
	bookPoints: numeric("book_points", { precision: 5, scale:  2 }),
	status: bookStatus(),
	addedByProfileId: uuid("added_by_profile_id"),
	approvedByProfileId: uuid("approved_by_profile_id"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	source: bookSource(),
	externalId: text("external_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	pageCount: integer("page_count"),
	previewLink: text("preview_link"),
	aiBookPoints: smallint("ai_book_points"),
	legacyBookPoints: numeric("legacy_book_points", { precision: 5, scale:  2 }),
	aiReason: text("ai_reason"),
	essayCount: integer("essay_count"),
}).as(sql`SELECT b.id, b.title, b.author, b.isbn_13, b.description, b.cover_path, b.tags, b.suggested_points, b.book_points, b.status, b.added_by_profile_id, b.approved_by_profile_id, b.approved_at, b.rejection_reason, b.source, b.external_id, b.created_at, b.updated_at, b.page_count, b.preview_link, b.ai_book_points, b.legacy_book_points, b.ai_reason, COALESCE(ec.essay_count, 0) AS essay_count FROM books b LEFT JOIN ( SELECT essays.book_id, count(*)::integer AS essay_count FROM essays WHERE essays.book_id IS NOT NULL GROUP BY essays.book_id) ec ON ec.book_id = b.id`);
