create or replace function public.can_view_birth_giving_event_organizers(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.birth_giving_event_organizers organizer
      join public.profiles caller_profile on caller_profile.id = organizer.profile_id
      join public.users caller_user on caller_user.id = caller_profile.user_id
      where organizer.event_id = target_event_id
        and caller_user.auth_user_id = (select auth.uid())
        and caller_profile.access_removed_at is null
    )
    or exists (
      select 1
      from public.birth_giving_events event
      join public.users caller_user on caller_user.auth_user_id = (select auth.uid())
      join public.profiles caller_profile on caller_profile.user_id = caller_user.id
      where event.id = target_event_id
        and event.status = 'published'
        and event.removed_at is null
        and caller_user.verified_work_email is not null
        and caller_profile.access_removed_at is null
    );
$$;

revoke all on function public.can_view_birth_giving_event_organizers(uuid) from public;
grant execute on function public.can_view_birth_giving_event_organizers(uuid) to authenticated;
