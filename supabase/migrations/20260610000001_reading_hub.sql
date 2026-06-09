-- ============================================================
-- essay_votes: one row per (essay, voter), drives vote_count
-- ============================================================

create table public.essay_votes (
  essay_id          uuid not null references public.essays(id) on delete cascade,
  voter_profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at        timestamptz not null default now(),
  primary key (essay_id, voter_profile_id)
);

alter table public.essays
  add column vote_count integer not null default 0;

create or replace function public.handle_essay_vote_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.essays set vote_count = vote_count + 1 where id = new.essay_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.essays set vote_count = greatest(0, vote_count - 1) where id = old.essay_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger essay_votes_change_trigger
  after insert or delete on public.essay_votes
  for each row execute function public.handle_essay_vote_change();

alter table public.essay_votes enable row level security;

create index essay_votes_voter_idx  on public.essay_votes(voter_profile_id);
create index if not exists essays_vote_count_idx on public.essays(vote_count desc, created_at desc);

create policy "Authenticated users can view votes"
  on public.essay_votes for select to authenticated using (true);

create policy "Users can vote (not own essays)"
  on public.essay_votes for insert to authenticated
  with check (
    voter_profile_id = public.current_profile_id()
    and essay_id not in (
      select id from public.essays
      where author_profile_id = public.current_profile_id()
    )
  );

create policy "Users can remove own votes"
  on public.essay_votes for delete to authenticated
  using (voter_profile_id = public.current_profile_id());

-- ============================================================
-- team_reading_lists + team_reading_list_books
-- ============================================================

create table public.team_reading_lists (
  id                    uuid primary key default gen_random_uuid(),
  team_id               uuid not null references public.teams(id) on delete cascade,
  title                 text not null,
  month                 text,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.team_reading_list_books (
  list_id   uuid not null references public.team_reading_lists(id) on delete cascade,
  book_id   uuid not null references public.books(id) on delete cascade,
  position  smallint not null default 0,
  primary key (list_id, book_id)
);

create trigger team_reading_lists_updated_at_trigger
  before update on public.team_reading_lists
  for each row execute function public.handle_updated_at();

create index team_reading_lists_team_idx      on public.team_reading_lists(team_id);
create index team_reading_list_books_list_idx on public.team_reading_list_books(list_id);

alter table public.team_reading_lists      enable row level security;
alter table public.team_reading_list_books enable row level security;

create policy "Authenticated users can view team lists"
  on public.team_reading_lists for select to authenticated using (true);

create policy "Team members can create lists"
  on public.team_reading_lists for insert to authenticated
  with check (
    team_id = (select team_id from public.profiles where id = public.current_profile_id())
  );

create policy "Team members can update their lists"
  on public.team_reading_lists for update to authenticated
  using (team_id = (select team_id from public.profiles where id = public.current_profile_id()))
  with check (team_id = (select team_id from public.profiles where id = public.current_profile_id()));

create policy "Team members can delete their lists"
  on public.team_reading_lists for delete to authenticated
  using (team_id = (select team_id from public.profiles where id = public.current_profile_id()));

create policy "Authenticated users can view list books"
  on public.team_reading_list_books for select to authenticated using (true);

create policy "Team members can manage list books"
  on public.team_reading_list_books for insert to authenticated
  with check (
    list_id in (
      select id from public.team_reading_lists
      where team_id = (select team_id from public.profiles where id = public.current_profile_id())
    )
  );

create policy "Team members can remove list books"
  on public.team_reading_list_books for delete to authenticated
  using (
    list_id in (
      select id from public.team_reading_lists
      where team_id = (select team_id from public.profiles where id = public.current_profile_id())
    )
  );
