-- Custom SQL migration file, put your code below! --

-- Migration: Realtime Authorization for Rocket Model broadcast channels
-- Purpose: Rocket Model subscribes to private: true channels on topics
--   "team:{team_id}:rocket", but no RLS policy existed on
--   realtime.messages for that topic shape. With no matching policy, RLS
--   denies by default: subscriptions fail with "Unauthorized: You do not
--   have permissions to read from this Channel topic" and teammate checks
--   never appear live (visible only after reload). These policies scope
--   access to members of the team the topic's team_id belongs to, matching
--   the "Teammates can ..." policies on rocket_individual_states /
--   rocket_team_checks.
-- Affected tables: realtime.messages
-- Special considerations: The client sends broadcasts directly
--   (channel.send / httpSend fallback), so the topic needs an insert
--   (send) policy in addition to the select (receive) policy.
--   Follows the precedent of 20260728210012_team_reflection_realtime_authz.sql.

-- ============================================================================
-- RLS POLICIES FOR REALTIME — team:{team_id}:rocket
-- ============================================================================

drop policy if exists "Team members can receive rocket broadcasts" on realtime.messages;

create policy "Team members can receive rocket broadcasts" on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) like 'team:%:rocket'
  and split_part((select realtime.topic()), ':', 2) in (
    select team_id::text from profiles where id = current_profile_id() and access_removed_at is null
  )
);

drop policy if exists "Team members can send rocket broadcasts" on realtime.messages;

create policy "Team members can send rocket broadcasts" on realtime.messages
for insert
to authenticated
with check (
  (select realtime.topic()) like 'team:%:rocket'
  and split_part((select realtime.topic()), ':', 2) in (
    select team_id::text from profiles where id = current_profile_id() and access_removed_at is null
  )
);

-- COMMENT ON POLICY requires table ownership (supabase_realtime_admin) and
-- fails with SQLSTATE 42501 under the migrator role — omitted, see
-- 20260201140000_broadcast_profile_link_changes.sql for precedent.
