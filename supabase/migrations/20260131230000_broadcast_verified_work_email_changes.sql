-- Migration: Broadcast verified_work_email changes via Realtime
-- Purpose: Enables cross-device synchronization by broadcasting verified_work_email changes to all user sessions
-- Affected tables: users, realtime.messages
-- Special considerations: Uses Realtime broadcast to notify all devices when email verification completes

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Create trigger function to broadcast verified_work_email changes via Realtime
-- Broadcasts to user-specific channel when verified_work_email changes
-- Uses realtime.send to broadcast custom event with verification details
create or replace function public.broadcast_verified_work_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_user_id uuid;
  v_old_email text;
  v_new_email text;
begin
  -- Only proceed if verified_work_email actually changed
  if old.verified_work_email is not distinct from new.verified_work_email then
    return new;
  end if;

  -- Get the auth_user_id for this user record
  v_user_id := new.auth_user_id;

  -- If no auth_user_id, cannot broadcast
  if v_user_id is null then
    return new;
  end if;

  -- Get old and new email values
  v_old_email := old.verified_work_email;
  v_new_email := new.verified_work_email;

  -- Broadcast to user-specific channel: user:{auth_user_id}:verification
  -- This allows all devices for this user to receive the notification
  -- Function signature: realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true)
  perform realtime.send(
    jsonb_build_object(
      'user_id', v_user_id,
      'old_email', v_old_email,
      'new_email', v_new_email,
      'verified_at', new.verified_work_email_at,
      'timestamp', now()
    ),
    'verified_work_email_changed',
    'user:' || v_user_id::text || ':verification',
    true -- private channel
  );

  return new;
end;
$$;

comment on function public.broadcast_verified_work_email_change() is 'Trigger function that broadcasts verified_work_email changes via Realtime to user-specific channel. Enables cross-device synchronization when email verification completes.';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create trigger on users table to broadcast verified_work_email changes
-- Runs AFTER UPDATE to ensure the change is committed
drop trigger if exists broadcast_verified_work_email_change_trigger on public.users;

create trigger broadcast_verified_work_email_change_trigger
after update of verified_work_email on public.users
for each row
when (old.verified_work_email is distinct from new.verified_work_email)
execute function public.broadcast_verified_work_email_change();

comment on trigger broadcast_verified_work_email_change_trigger on public.users is 'Broadcasts verified_work_email changes via Realtime to enable cross-device synchronization.';

-- ============================================================================
-- RLS POLICIES FOR REALTIME
-- ============================================================================

-- Drop existing policy if it exists (for idempotency)
drop policy if exists "Users can receive their own verification broadcasts" on realtime.messages;

-- Create RLS policy for users to receive their own verification broadcasts
-- Users can only subscribe to their own user:{auth_user_id}:verification channel
create policy "Users can receive their own verification broadcasts" on realtime.messages
for select
to authenticated
using (
  topic = 'user:' || (select auth.uid())::text || ':verification'
);

comment on policy "Users can receive their own verification broadcasts" on realtime.messages is 'Allows authenticated users to receive Realtime broadcasts on their own verification channel. Enables cross-device synchronization when email verification completes.';

-- Note: Index creation on realtime.messages may require special permissions
-- The RLS policy will work without the index, though performance may be slightly reduced
-- If needed, create the index manually with appropriate permissions:
-- create index idx_realtime_messages_topic_user_verification
-- on realtime.messages(topic)
-- where topic like 'user:%:verification';
