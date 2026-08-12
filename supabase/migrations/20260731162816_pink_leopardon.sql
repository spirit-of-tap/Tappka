-- Restrict the /hledat "best books per category" section to shortlisted
-- (verified) books only — previously included longlist too. Body-only
-- change, same signature, so CREATE OR REPLACE is sufficient (no drop needed).
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
    where b.list_status = 'shortlist'
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
$function$;