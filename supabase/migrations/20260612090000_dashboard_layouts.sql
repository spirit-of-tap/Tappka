-- Per-user dashboard layout: ordered list of widget ids shown on the main page.
create table public.dashboard_layouts (
    profile_id uuid primary key references public.profiles(id) on delete cascade,
    widgets jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

comment on table public.dashboard_layouts is 'Ordered widget ids each user picked for their main dashboard.';

alter table public.dashboard_layouts enable row level security;

create policy "Users can view their own dashboard layout"
  on public.dashboard_layouts for select
  using (profile_id = public.current_profile_id());

create policy "Users can insert their own dashboard layout"
  on public.dashboard_layouts for insert
  with check (profile_id = public.current_profile_id());

create policy "Users can update their own dashboard layout"
  on public.dashboard_layouts for update
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

create policy "Users can delete their own dashboard layout"
  on public.dashboard_layouts for delete
  using (profile_id = public.current_profile_id());
