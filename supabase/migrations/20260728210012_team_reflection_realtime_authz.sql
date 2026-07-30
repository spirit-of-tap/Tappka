-- Custom SQL migration file, put your code below! --

-- Migration: Realtime Authorization for team reflection broadcast channels
-- Purpose: Team reflection and semester reflection features subscribe to
--   private: true channels on topics "team:{team_id}:reflection" and
--   "team:{team_id}:semester-reflection:{reflection_id}", but no RLS policy
--   existed on realtime.messages for either topic shape. With no matching
--   policy, RLS denies by default and every subscription attempt fails with
--   "Unauthorized". These policies scope access to members of the team the
--   topic's team_id belongs to, matching the "Team members can ..." policies
--   already defined on team_reflections / team_semester_reflections.
-- Affected tables: realtime.messages
-- Special considerations: Both features send broadcasts directly from the
--   client (channel.send), so each topic needs an insert (send) policy in
--   addition to the select (receive) policy.

-- ============================================================================
-- RLS POLICIES FOR REALTIME — team:{team_id}:reflection
-- ============================================================================

drop policy if exists "Team members can receive reflection broadcasts" on realtime.messages;

create policy "Team members can receive reflection broadcasts" on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) like 'team:%:reflection'
  and split_part((select realtime.topic()), ':', 2) in (
    select team_id::text from profiles where id = current_profile_id() and access_removed_at is null
  )
);

drop policy if exists "Team members can send reflection broadcasts" on realtime.messages;

create policy "Team members can send reflection broadcasts" on realtime.messages
for insert
to authenticated
with check (
  (select realtime.topic()) like 'team:%:reflection'
  and split_part((select realtime.topic()), ':', 2) in (
    select team_id::text from profiles where id = current_profile_id() and access_removed_at is null
  )
);

-- ============================================================================
-- RLS POLICIES FOR REALTIME — team:{team_id}:semester-reflection:{reflection_id}
-- ============================================================================

drop policy if exists "Team members can receive semester reflection broadcasts" on realtime.messages;

create policy "Team members can receive semester reflection broadcasts" on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) like 'team:%:semester-reflection:%'
  and split_part((select realtime.topic()), ':', 2) in (
    select team_id::text from profiles where id = current_profile_id() and access_removed_at is null
  )
);

drop policy if exists "Team members can send semester reflection broadcasts" on realtime.messages;

create policy "Team members can send semester reflection broadcasts" on realtime.messages
for insert
to authenticated
with check (
  (select realtime.topic()) like 'team:%:semester-reflection:%'
  and split_part((select realtime.topic()), ':', 2) in (
    select team_id::text from profiles where id = current_profile_id() and access_removed_at is null
  )
);

-- COMMENT ON POLICY requires table ownership (supabase_realtime_admin) and
-- fails with SQLSTATE 42501 under the migrator role — omitted, see
-- 20260201140000_broadcast_profile_link_changes.sql for precedent.
