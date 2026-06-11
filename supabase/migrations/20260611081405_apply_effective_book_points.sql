-- ============================================================================
-- Apply the effective book_points rule to existing approved books.
-- ----------------------------------------------------------------------------
-- Effective points per book:
--   created_at >= 2026-07-01  -> ai_book_points  (fallback legacy)
--   created_at <  2026-07-01  -> legacy_book_points (fallback ai)
-- All currently-imported books predate the cutover, so they switch to their
-- legacy values (which may be fractional, e.g. 0.33).
--
-- books_protect_approved_trigger blocks book_points changes on approved books,
-- so it is dropped for this authorized one-time correction and recreated
-- immediately afterwards (single transaction).
-- ============================================================================

drop trigger if exists books_protect_approved_trigger on public.books;

update public.books
set book_points = case
  when status = 'approved' then
    case
      when created_at >= timestamptz '2026-07-01 00:00:00+00'
        then coalesce(ai_book_points, legacy_book_points, 0)
      else coalesce(legacy_book_points, ai_book_points, 0)
    end
  else 0
end;

create trigger books_protect_approved_trigger
  before update on public.books
  for each row execute function public.protect_approved_book();
