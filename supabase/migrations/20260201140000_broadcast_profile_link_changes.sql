-- Migration: Broadcast profile link changes via Realtime
-- Purpose: Enables cross-device synchronization by broadcasting when profiles.user_id changes from null to a value
-- Affected tables: profiles, realtime.messages
-- Special considerations: Uses Realtime broadcast to notify all user sessions when profile is linked (approved)

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Create trigger function to broadcast profile link changes via Realtime
-- Broadcasts to user-specific channel when profile.user_id changes from null to a value
-- Uses realtime.send to broadcast custom event with profile details
create or replace function public.broadcast_profile_link_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_auth_user_id uuid;
  v_old_user_id uuid;
  v_new_user_id uuid;
begin
  -- Only proceed if user_id actually changed from null to a value
  -- This means the profile was just linked (admin approved)
  if old.user_id is not null then
    -- Profile was already linked, not a new link event
    return new;
  end if;

  if new.user_id is null then
    -- Profile still not linked
    return new;
  end if;

  -- Get the new user_id
  v_new_user_id := new.user_id;

  -- Get the auth_user_id for this user record
  select auth_user_id into v_auth_user_id
  from public.users
  where id = v_new_user_id;

  -- If no auth_user_id found, cannot broadcast
  if v_auth_user_id is null then
    return new;
  end if;

  -- Broadcast to user-specific channel: user:{auth_user_id}:profile
  -- This allows all devices for this user to receive the notification
  -- Function signature: realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true)
  perform realtime.send(
    jsonb_build_object(
      'auth_user_id', v_auth_user_id,
      'user_id', v_new_user_id,
      'profile_id', new.id,
      'profile_name', new.name,
      'profile_role', new.role,
      'work_email', new.work_email,
      'linked_at', now(),
      'timestamp', now()
    ),
    'profile_linked',
    'user:' || v_auth_user_id::text || ':profile',
    true -- private channel
  );

  return new;
end;
$$;

comment on function public.broadcast_profile_link_change() is 'Trigger function that broadcasts profile link changes via Realtime to user-specific channel. Enables cross-device synchronization when admin approves/links a profile to a user.';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create trigger on profiles table to broadcast profile link changes
-- Runs AFTER UPDATE to ensure the change is committed
drop trigger if exists broadcast_profile_link_change_trigger on public.profiles;

create trigger broadcast_profile_link_change_trigger
after update of user_id on public.profiles
for each row
when (old.user_id is null and new.user_id is not null)
execute function public.broadcast_profile_link_change();

comment on trigger broadcast_profile_link_change_trigger on public.profiles is 'Broadcasts profile link changes via Realtime to enable cross-device synchronization when profile is approved/linked.';

-- ============================================================================
-- RLS POLICIES FOR REALTIME
-- ============================================================================

-- Drop existing policy if it exists (for idempotency)
drop policy if exists "Users can receive their own profile link broadcasts" on realtime.messages;

-- Create RLS policy for users to receive their own profile link broadcasts
-- Users can only subscribe to their own user:{auth_user_id}:profile channel
create policy "Users can receive their own profile link broadcasts" on realtime.messages
for select
to authenticated
using (
  topic = 'user:' || (select auth.uid())::text || ':profile'
);

comment on policy "Users can receive their own profile link broadcasts" on realtime.messages is 'Allows authenticated users to receive Realtime broadcasts on their own profile channel. Enables cross-device synchronization when profile is approved/linked by admin.';

-- Note: Index creation on realtime.messages may require special permissions
-- The RLS policy will work without the index, though performance may be slightly reduced
-- If needed, create the index manually with appropriate permissions:
-- create index idx_realtime_messages_topic_user_profile
-- on realtime.messages(topic)
-- where topic like 'user:%:profile';
