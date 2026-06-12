-- Restores a migration that was applied to live databases but never committed.
-- 20260610000003 (recreate books_with_essay_count view) depends on these columns,
-- so a fresh rebuild (supabase db reset / new environment) fails without this file.
-- IF NOT EXISTS keeps it a no-op on databases where the columns already exist.

alter table public.books add column if not exists page_count integer;

alter table public.books add column if not exists preview_link text;
