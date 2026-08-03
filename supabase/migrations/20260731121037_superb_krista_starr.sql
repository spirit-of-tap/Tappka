CREATE TYPE "public"."book_list_status" AS ENUM('processing', 'shortlist', 'longlist', 'archived');--> statement-breakpoint
CREATE TYPE "public"."highlight_category" AS ENUM('ja', 'my', 'oni', 'system');--> statement-breakpoint
CREATE TABLE "book_highlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"category" "highlight_category" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL,
	CONSTRAINT "book_highlights_book_id_key" UNIQUE("book_id")
);
--> statement-breakpoint
ALTER TABLE "book_highlights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Drop objects that depend on the old book_status enum / books_with_essay_count
-- view before the enum type and view can be dropped.
DROP TRIGGER IF EXISTS "books_protect_approved_trigger" ON "public"."books";--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."protect_approved_book"();--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."get_best_books_per_category"(integer);--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."get_teams_with_member_stats"();--> statement-breakpoint
DROP VIEW "public"."books_with_essay_count";--> statement-breakpoint
ALTER TABLE "books" RENAME COLUMN "status" TO "list_status";--> statement-breakpoint
ALTER TABLE "books" RENAME COLUMN "status_changed_at" TO "list_status_changed_at";--> statement-breakpoint
ALTER TABLE "books" RENAME COLUMN "status_changed_by_profile_id" TO "list_status_changed_by_profile_id";--> statement-breakpoint
ALTER TABLE "books" RENAME COLUMN "status_reason" TO "list_status_reason";--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT "books_status_changed_by_profile_id_fkey";
--> statement-breakpoint
DROP INDEX "books_status_idx";--> statement-breakpoint
-- Switch the column to the new enum, mapping legacy values onto list statuses.
-- The old default ('pending'::book_status) cannot be auto-cast, so drop it
-- before the type change and restore it as 'processing' afterwards.
ALTER TABLE "books" ALTER COLUMN "list_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "list_status" SET DATA TYPE "public"."book_list_status" USING (
	CASE "list_status"::text
		WHEN 'pending' THEN 'processing'::public.book_list_status
		WHEN 'approved' THEN 'longlist'::public.book_list_status
		WHEN 'rejected' THEN 'archived'::public.book_list_status
	END
);--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "list_status" SET DEFAULT 'processing'::public.book_list_status;--> statement-breakpoint
-- Archived books are not eligible for points. Existing rejected rows carry
-- NULL book_points; zero them BEFORE the archived-points CHECK is added.
UPDATE "books" SET "book_points" = 0 WHERE "list_status" = 'archived';--> statement-breakpoint
ALTER TABLE "book_highlights" ADD CONSTRAINT "book_highlights_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_highlights" ADD CONSTRAINT "book_highlights_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_highlights" ADD CONSTRAINT "book_highlights_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_highlights_category_idx" ON "book_highlights" USING btree ("category" enum_ops);--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_list_status_changed_by_profile_id_fkey" FOREIGN KEY ("list_status_changed_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_list_status_idx" ON "books" USING btree ("list_status" enum_ops);--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_archived_points_check" CHECK ((list_status <> 'archived') OR (book_points = (0)::numeric));--> statement-breakpoint
CREATE VIEW "public"."books_with_essay_count" AS (SELECT b.id, b.title_cs, b.title_en, b.author, b.isbn_13, b.description, b.google_books_cover_url, b.book_points, b.page_count, b.preview_link, b.source, b.external_id, b.list_status, b.list_status_changed_at, b.list_status_changed_by_profile_id, b.list_status_reason, b.created_at, b.updated_at, b.created_by_profile_id, b.updated_by_profile_id, COALESCE(ec.essay_count, 0) AS essay_count FROM books b LEFT JOIN ( SELECT essays.book_id, count(*)::integer AS essay_count FROM essays WHERE essays.book_id IS NOT NULL GROUP BY essays.book_id) ec ON ec.book_id = b.id);--> statement-breakpoint
CREATE POLICY "Authenticated users can view book highlights" ON "book_highlights" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Coaches and admins can add book highlights" ON "book_highlights" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can update book highlights" ON "book_highlights" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_coach_or_admin()) WITH CHECK (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can delete book highlights" ON "book_highlights" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_coach_or_admin());--> statement-breakpoint
DROP TYPE "public"."book_status";--> statement-breakpoint
-- Recreate functions with the new list_status filter: books on the shortlist
-- and longlist are the ones eligible for points.
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
CREATE OR REPLACE FUNCTION public.get_teams_with_member_stats()
 RETURNS TABLE(team_id uuid, team_name text, profile_id uuid, profile_name text, profile_picture text, essay_count bigint, book_points numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with member_essays as (
    select author_profile_id, count(id) as essay_count
    from public.essays
    where published_at is not null
      and removed_at is null
    group by author_profile_id
  ),
  member_points as (
    select
      sub.author_profile_id,
      coalesce(sum(b.book_points), 0) as book_points
    from (
      select distinct e.author_profile_id, e.book_id
      from public.essays e
      where e.book_id is not null
        and e.published_at is not null
        and e.removed_at is null
    ) sub
    join public.books b
      on b.id = sub.book_id
     and b.list_status in ('shortlist', 'longlist')
    group by sub.author_profile_id
  )
  select
    t.id as team_id,
    t.name as team_name,
    p.id as profile_id,
    p.name as profile_name,
    p.picture as profile_picture,
    coalesce(me.essay_count, 0) as essay_count,
    coalesce(mp.book_points, 0) as book_points
  from public.teams t
  join public.profiles p
    on p.team_id = t.id
   and p.access_removed_at is null
  left join member_essays me on me.author_profile_id = p.id
  left join member_points mp on mp.author_profile_id = p.id
  where t.removed_at is null
  order by t.name, coalesce(mp.book_points, 0) desc, p.name;
$function$;
