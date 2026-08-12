CREATE TABLE "highlight_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "highlight_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- get_best_books_per_category references books_with_essay_count, so drop it
-- before the view and recreate it afterwards.
DROP FUNCTION IF EXISTS "public"."get_best_books_per_category"(integer);--> statement-breakpoint
DROP VIEW "public"."books_with_essay_count";--> statement-breakpoint
DROP POLICY "Authenticated users can view book highlights" ON "book_highlights" CASCADE;--> statement-breakpoint
DROP POLICY "Coaches and admins can add book highlights" ON "book_highlights" CASCADE;--> statement-breakpoint
DROP POLICY "Coaches and admins can update book highlights" ON "book_highlights" CASCADE;--> statement-breakpoint
DROP POLICY "Coaches and admins can delete book highlights" ON "book_highlights" CASCADE;--> statement-breakpoint
DROP TABLE "book_highlights" CASCADE;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "highlight_category_id" uuid;--> statement-breakpoint
ALTER TABLE "highlight_categories" ADD CONSTRAINT "highlight_categories_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlight_categories" ADD CONSTRAINT "highlight_categories_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_highlight_category_id_fkey" FOREIGN KEY ("highlight_category_id") REFERENCES "public"."highlight_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE VIEW "public"."books_with_essay_count" AS (SELECT b.id, b.title_cs, b.title_en, b.author, b.isbn_13, b.description, b.google_books_cover_url, b.book_points, b.page_count, b.preview_link, b.source, b.external_id, b.list_status, b.list_status_changed_at, b.list_status_changed_by_profile_id, b.list_status_reason, b.highlight_category_id, b.created_at, b.updated_at, b.created_by_profile_id, b.updated_by_profile_id, COALESCE(ec.essay_count, 0) AS essay_count FROM books b LEFT JOIN ( SELECT essays.book_id, count(*)::integer AS essay_count FROM essays WHERE essays.book_id IS NOT NULL GROUP BY essays.book_id) ec ON ec.book_id = b.id);--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.get_best_books_per_category(top_n integer DEFAULT 3)
 RETURNS TABLE(tag text, id uuid, title text, author text, cover_path text, description text, preview_link text, tags text[], book_points numeric, essay_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with book_tag_names as (
    select
      bt.book_id,
      array_agg(tg.name order by tg.name) as tags
    from public.book_tags bt
    join public.tags tg on tg.id = bt.tag_id
    group by bt.book_id
  ),
  ranked as (
    select
      tg.name as tag,
      b.id,
      b.title_cs as title,
      b.title_en,
      b.author,
      b.google_books_cover_url as cover_path,
      b.description,
      b.preview_link,
      coalesce(btn.tags, '{}'::text[]) as tags,
      b.book_points,
      b.essay_count,
      row_number() over (
        partition by tg.name
        order by (b.essay_count * 3 + coalesce(b.book_points, 0)) desc, b.created_at desc
      ) as rn
    from public.books_with_essay_count b
    join public.book_tags bt on bt.book_id = b.id
    join public.tags tg on tg.id = bt.tag_id
    left join book_tag_names btn on btn.book_id = b.id
    where b.list_status in ('shortlist', 'longlist')
  )
  select
    ranked.tag,
    ranked.id,
    ranked.title,
    ranked.author,
    ranked.cover_path,
    ranked.description,
    ranked.preview_link,
    ranked.tags,
    ranked.book_points,
    ranked.essay_count
  from ranked
  where ranked.rn <= top_n
  order by ranked.tag, ranked.rn;
$function$;--> statement-breakpoint
CREATE POLICY "Authenticated users can view highlight categories" ON "highlight_categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Coaches and admins can add highlight categories" ON "highlight_categories" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can update highlight categories" ON "highlight_categories" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_coach_or_admin()) WITH CHECK (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can delete highlight categories" ON "highlight_categories" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_coach_or_admin());--> statement-breakpoint
DROP TYPE "public"."highlight_category";