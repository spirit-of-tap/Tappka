create extension if not exists pg_trgm;
create index if not exists essays_title_trgm_idx on public.essays using gin (title gin_trgm_ops);
