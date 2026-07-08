-- Custom SQL migration file, put your code below! --

-- Pin search_path on the two SECURITY DEFINER functions flagged by the
-- Supabase linter (0011_function_search_path_mutable). Both bodies already
-- fully schema-qualify every reference (public.*), so an empty search_path
-- is safe. CREATE OR REPLACE is forward-only and idempotent.

CREATE OR REPLACE FUNCTION public.get_best_books_per_category(top_n integer DEFAULT 3)
 RETURNS TABLE(tag text, id uuid, title text, author text, cover_path text, description text, preview_link text, tags text[], book_points integer, essay_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  WITH ranked AS (
    SELECT
      t.tag,
      b.id, b.title, b.author, b.cover_path, b.description, b.preview_link,
      b.tags, b.book_points, b.essay_count,
      ROW_NUMBER() OVER (
        PARTITION BY t.tag
        ORDER BY (b.essay_count * 3 + b.book_points) DESC, b.created_at DESC
      ) AS rn
    FROM public.books_with_essay_count b
    CROSS JOIN LATERAL unnest(b.tags) AS t(tag)
    WHERE b.status = 'approved'
  )
  SELECT tag, id, title, author, cover_path, description, preview_link, tags, book_points, essay_count
  FROM ranked
  WHERE rn <= top_n
  ORDER BY tag, rn;
$function$
;

CREATE OR REPLACE FUNCTION public.get_teams_with_member_stats()
 RETURNS TABLE(team_id uuid, team_name text, profile_id uuid, profile_name text, profile_picture text, essay_count bigint, book_points bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  WITH member_essays AS (
    SELECT author_profile_id, COUNT(id) AS essay_count
    FROM public.essays
    WHERE published = true
    GROUP BY author_profile_id
  ),
  member_points AS (
    SELECT sub.author_profile_id, COALESCE(SUM(b.book_points), 0) AS book_points
    FROM (
      SELECT DISTINCT e.author_profile_id, e.book_id
      FROM public.essays e
      WHERE e.book_id IS NOT NULL AND e.published = true
    ) sub
    JOIN public.books b ON b.id = sub.book_id AND b.status = 'approved'
    GROUP BY sub.author_profile_id
  )
  SELECT
    t.id          AS team_id,
    t.name        AS team_name,
    p.id          AS profile_id,
    p.name        AS profile_name,
    p.picture     AS profile_picture,
    COALESCE(me.essay_count, 0)  AS essay_count,
    COALESCE(mp.book_points, 0)  AS book_points
  FROM public.teams t
  JOIN public.profiles p ON p.team_id = t.id AND p.removed_access IS NULL
  LEFT JOIN member_essays me ON me.author_profile_id = p.id
  LEFT JOIN member_points mp ON mp.author_profile_id = p.id
  ORDER BY t.name, COALESCE(mp.book_points, 0) DESC, p.name;
$function$
;
