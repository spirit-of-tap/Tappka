# Birth Giving Three-Table Design

## Goal

Replace the legacy eleven-table Birth Giving model with three tables without weakening authorization, exposing embargoed assignments, or making multi-row mutations non-atomic.

The legacy Birth Giving tables are empty in every target environment. The migration may therefore drop them, but it must abort if that assumption is false at deployment time.

## Data Model

The final model contains:

- `birth_giving_events` for event metadata, organizer profile IDs, assignment state, and assignment file metadata.
- `birth_giving_teams` for teams, winner state, result state, and result-file JSON.
- `birth_giving_team_members` for membership and reflection fields.

The retained enums are `birth_giving_duration`, `birth_giving_event_status`, `birth_giving_assignment_state`, and `birth_giving_team_result_state`. The assignment enum gains `none`.

The schema retains the composite unique constraint `birth_giving_teams_event_id_id_key` and composite membership foreign key `birth_giving_team_members_event_team_fkey`. Checks keep assignment metadata, result state/files, cancellation fields, and reflection fields internally consistent. A partial unique index permits at most one active winner per event.

## Authorization

Table access is asymmetric:

- Active, verified beta profiles receive RLS-protected reads.
- Drafts are visible only to their organizers; published events are visible to the active verified beta community.
- Direct inserts, updates, and deletes are denied on all three tables.
- Sensitive and multi-row writes use narrow `SECURITY DEFINER` functions.
- Functions resolve the caller through `auth.uid()`, verify active profile access, verified work email, and beta access, use an empty fixed `search_path`, and schema-qualify every object.

Authenticated callers do not receive direct select privileges on embedded assignment columns. Normal event queries select only safe columns. `birth_giving_get_visible_assignment` returns actual assignment metadata only to organizers or at/after `starts_at`; before that it returns `none` and null metadata. The assignment download route repeats the embargo check before signing a URL.

## Mutation Functions

The custom SQL layer provides these operations:

- `birth_giving_save_event` creates a draft or updates organizer-editable event fields.
- `birth_giving_publish_event` validates and publishes a draft under an event lock.
- `birth_giving_remove_event` performs organizer-only soft deletion.
- `birth_giving_create_team` atomically creates a team and its memberships.
- `birth_giving_update_team` atomically updates name, memberships, and winner state.
- `birth_giving_delete_team` performs organizer-only team deletion.
- `birth_giving_set_assignment` performs organizer-only present/missing transitions and returns displaced storage paths.
- `birth_giving_add_result_file` appends validated result metadata under a team lock.
- `birth_giving_remove_result_file` removes one result and returns its storage path.
- `birth_giving_mark_result_missing` clears all results and returns their storage paths.
- `birth_giving_upsert_reflection` updates only the caller's membership reflection.
- `birth_giving_get_visible_assignment` enforces assignment visibility.

Event creation always includes the caller among organizers. A past retrospective draft requires an explicit assignment state, at least one team, at least one member per team, and no pending team result before publication. Team winner replacement and membership synchronization occur in one transaction. Result mutations are available only to an event organizer or a member of the matching team.

## Storage And Notifications

Presign routes authorize the caller before issuing an event/team-scoped random key. Confirmation routes inspect the stored object and compare its real MIME type and size with submitted metadata before calling the registration RPC. The database also rejects paths outside the exact assignment or result prefix.

Replacement, missing, and removal functions return displaced paths. Routes delete those objects after the database commit and surface cleanup failures. If registration fails, the newly uploaded object is deleted best-effort.

The obsolete storage-cleanup table, RPCs, helper, and cron are removed. The assignment notification cron remains but is rewritten to send only for published events whose start time has arrived. Its provider idempotency key includes the assignment upload timestamp and recipient email, so a replacement sends once while repeated cron runs remain safe.

## Migration Sequence

The migration is deliberately staged:

1. A custom migration verifies all eleven legacy tables are empty.
2. Drizzle drops the eleven tables and their policies while retaining enum objects.
3. A custom migration retires legacy Birth Giving functions after their table and policy dependencies are gone.
4. Drizzle drops only the five obsolete enums.
5. Drizzle creates the final three-table schema with four enums and read-only RLS.
6. A custom migration creates mutation/read functions, triggers, grants, and assignment column restrictions.

This ordering avoids trigger, policy, function-signature, and enum dependencies. Structural DDL remains Drizzle-generated.

## Errors And Testing

Functions use stable PostgreSQL errors: `42501` for authorization, `P0002` for missing resources, `23505` for duplicate identity or membership conflicts, `23503` for invalid relationships, and `23514` for invalid state. API helpers map these to consistent Czech responses.

Integration coverage verifies the migration guard, final object count, enums, RLS, grants, direct-write denial, authorization roles, assignment embargo boundaries, atomic winner and membership updates, concurrent result appends, path validation, reflection ownership, and state checks. Unit route tests cover RPC payloads, error mapping, storage inspection/deletion, and notification timing. Completion requires migration integrity, unit/component tests, integration tests, typecheck, and build.
