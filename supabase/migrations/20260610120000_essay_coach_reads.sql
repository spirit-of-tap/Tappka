-- ============================================================================
-- Coach essay review: explicit "read" acknowledgements
-- ----------------------------------------------------------------------------
-- Coaches review essays written by students in their team and explicitly mark
-- them as read. This is distinct from passive essay_views (which are recorded
-- on open). A read exists iff a row exists; unmarking deletes the row.
-- ============================================================================

create table public.essay_coach_reads (
  essay_id uuid not null references public.essays(id) on delete cascade,
  coach_profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (essay_id, coach_profile_id)
);

comment on table public.essay_coach_reads is 'Explicit "reviewed" acknowledgements by a coach for a team member''s essay. Distinct from passive essay_views.';

create index essay_coach_reads_coach_idx on public.essay_coach_reads(coach_profile_id);

-- ----------------------------------------------------------------------------
-- Helper: may the calling coach/admin review (mark read) this essay?
-- True when caller is a coach/admin AND (caller is admin OR the essay author
-- shares the caller's team). Admins may review any team.
-- ----------------------------------------------------------------------------
create or replace function public.coach_can_review_essay(p_essay_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.is_coach_or_admin()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.essays e
        join public.profiles author on author.id = e.author_profile_id
        join public.profiles caller on caller.id = public.current_profile_id()
        where e.id = p_essay_id
          and author.team_id is not null
          and author.team_id = caller.team_id
      )
    );
$$;

comment on function public.coach_can_review_essay(uuid) is 'True if the calling coach/admin may mark the given essay as read (admin: any; coach: own team only).';

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.essay_coach_reads enable row level security;

-- The coach who created the row can see it; the essay author can see who read
-- their essay (drives the "Přečteno koučem" banner).
create policy "Coach sees own reads; author sees reads of own essays"
  on public.essay_coach_reads for select
  to authenticated
  using (
    coach_profile_id = public.current_profile_id()
    or exists (
      select 1 from public.essays e
      where e.id = essay_coach_reads.essay_id
        and e.author_profile_id = public.current_profile_id()
    )
  );

-- A coach/admin marks an essay read only for themselves, and only within scope.
create policy "Coaches mark own reads within their team"
  on public.essay_coach_reads for insert
  to authenticated
  with check (
    coach_profile_id = public.current_profile_id()
    and public.coach_can_review_essay(essay_id)
  );

-- A coach can remove (unmark) their own read row.
create policy "Coaches remove own reads"
  on public.essay_coach_reads for delete
  to authenticated
  using (coach_profile_id = public.current_profile_id());
