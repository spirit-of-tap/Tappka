-- Restores schema changes that were applied to live databases out-of-band
-- (orphan history entry 20260611120000, file never committed) and therefore
-- lost on any rebuild from the committed migration history.
-- Captured from the Drizzle baseline (db/schema), which introspected the
-- database before the rebuild. Idempotent: no-op where objects already exist.

alter table public.team_reading_list_books
  add column if not exists note text;

alter table public.essay_comments
  add column if not exists is_linda_nudge boolean not null default false;

alter table public.essay_comments
  add column if not exists nudge_status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'essay_comments_nudge_status_check'
      and conrelid = 'public.essay_comments'::regclass
  ) then
    alter table public.essay_comments
      add constraint essay_comments_nudge_status_check
      check ((nudge_status is null) or (nudge_status = any (array['open'::text, 'resolved'::text])));
  end if;
end $$;

create index if not exists essay_comments_open_linda_nudge_idx
  on public.essay_comments using btree (essay_id)
  where (is_linda_nudge and nudge_status = 'open'::text);
