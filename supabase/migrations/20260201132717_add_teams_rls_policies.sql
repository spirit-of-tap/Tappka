-- Migration: Add RLS policies for teams table
-- Purpose: Allow authenticated users to read teams, especially teams referenced by their profiles
-- Affected tables: teams
-- Special considerations: Teams are public data that authenticated users should be able to read

-- Allow authenticated users to read all teams
-- This is necessary for foreign key relationships (e.g., team:teams(*) in profiles queries)
-- Teams are organizational data that should be visible to all authenticated users
create policy "Authenticated users can read teams" on public.teams
for select
to authenticated
using (true);

comment on policy "Authenticated users can read teams" on public.teams is 'Allows all authenticated users to read team information. This is necessary for foreign key relationships in profile queries and for displaying team information in the application.';
