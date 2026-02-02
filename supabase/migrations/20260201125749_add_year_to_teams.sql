-- Migration: Add year column to teams table
-- Purpose: Adds a year integer field to track the cohort year for teams
-- Affected tables: teams
-- Special considerations: Column is nullable to allow existing teams to continue functioning

-- Add year column to teams table
alter table public.teams
  add column year integer;

comment on column public.teams.year is 'Cohort year for the team (e.g., 1, 2, 3 for first, second, third year students)';
