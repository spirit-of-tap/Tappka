DROP VIEW "public"."books_with_essay_count";--> statement-breakpoint
ALTER TABLE "books" RENAME COLUMN "title" TO "title_cs";--> statement-breakpoint
ALTER TABLE "books" RENAME COLUMN "supabase_cover_img_url" TO "google_books_cover_url";--> statement-breakpoint
DROP INDEX "books_title_trgm_idx";--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "title_en" text;--> statement-breakpoint
ALTER TABLE "essays" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE INDEX "books_title_cs_trgm_idx" ON "books" USING gin ("title_cs" gin_trgm_ops);--> statement-breakpoint
CREATE VIEW "public"."books_with_essay_count" AS (SELECT b.id, b.title_cs, b.title_en, b.author, b.isbn_13, b.description, b.google_books_cover_url, b.book_points, b.page_count, b.preview_link, b.source, b.external_id, b.status, b.status_changed_at, b.status_changed_by_profile_id, b.status_reason, b.created_at, b.updated_at, b.created_by_profile_id, b.updated_by_profile_id, COALESCE(ec.essay_count, 0) AS essay_count FROM books b LEFT JOIN ( SELECT essays.book_id, count(*)::integer AS essay_count FROM essays WHERE essays.book_id IS NOT NULL GROUP BY essays.book_id) ec ON ec.book_id = b.id);