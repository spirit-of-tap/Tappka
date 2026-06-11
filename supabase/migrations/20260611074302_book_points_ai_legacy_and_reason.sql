-- ============================================================================
-- Book points: store AI-suggested and legacy point values separately, keep an
-- AI acceptance reason, and make the effective book_points fractional.
-- ----------------------------------------------------------------------------
-- The legacy scoring system used fractional values (e.g. 0.33), so book_points
-- becomes numeric. The effective book_points is chosen per book:
--   created_at >= 2026-07-01  -> ai_book_points
--   created_at <  2026-07-01  -> legacy_book_points
-- (Backfill is applied separately; this migration only changes the schema.)
-- ============================================================================

-- The view selects book_points, so it must be dropped before the type change.
drop view if exists public.books_with_essay_count;

alter table public.books
  alter column book_points drop default;

alter table public.books
  alter column book_points type numeric(5,2) using book_points::numeric;

alter table public.books
  alter column book_points set default 0;

alter table public.books
  add column ai_book_points smallint,
  add column legacy_book_points numeric(5,2),
  add column ai_reason text;

comment on column public.books.ai_book_points is 'AI-suggested points (1-3). Effective book_points for books created on/after 2026-07-01.';
comment on column public.books.legacy_book_points is 'Original human-assigned points from the legacy system; may be fractional (e.g. 0.33). Effective book_points for books created before 2026-07-01.';
comment on column public.books.ai_reason is 'AI-generated explanation of why the book was accepted and rated.';

-- Recreate the view with the same shape plus the new columns.
create view public.books_with_essay_count as
  select b.id,
    b.title,
    b.author,
    b.isbn_13,
    b.description,
    b.cover_path,
    b.tags,
    b.suggested_points,
    b.book_points,
    b.status,
    b.added_by_profile_id,
    b.approved_by_profile_id,
    b.approved_at,
    b.rejection_reason,
    b.source,
    b.external_id,
    b.created_at,
    b.updated_at,
    b.page_count,
    b.preview_link,
    b.ai_book_points,
    b.legacy_book_points,
    b.ai_reason,
    coalesce(ec.essay_count, 0) as essay_count
   from public.books b
     left join (
       select essays.book_id,
              count(*)::integer as essay_count
         from public.essays
        where essays.book_id is not null
        group by essays.book_id
     ) ec on ec.book_id = b.id;
