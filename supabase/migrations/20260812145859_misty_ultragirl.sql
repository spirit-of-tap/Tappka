-- Custom SQL migration file, put your code below! --

-- RPC: get a profile's notification email preferences, security definer so
-- the caller can check another profile's preferences (needed when dispatching
-- a notification to that profile). Missing row: essay prefs default on,
-- book_submitted_email is opt-in and defaults off.
-- The return type gains book_submitted_email, which CREATE OR REPLACE cannot
-- do — the function must be dropped and recreated.
drop function if exists public.get_notification_preferences(uuid);

create function public.get_notification_preferences(p_profile_id uuid)
returns table (
  essay_coach_read_email boolean,
  essay_comment_email boolean,
  essay_vote_email boolean,
  book_submitted_email boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(np.essay_coach_read_email, true),
    coalesce(np.essay_comment_email, true),
    coalesce(np.essay_vote_email, true),
    coalesce(np.book_submitted_email, false)
  from (select p_profile_id as profile_id) target
  left join public.notification_preferences np on np.profile_id = target.profile_id;
$$;

comment on function public.get_notification_preferences(uuid) is 'Returns notification email preferences for a profile; missing row defaults essay prefs to on and book_submitted_email to off.';

grant execute on function public.get_notification_preferences(uuid) to authenticated;
