DO $$
DECLARE
  legacy_table text;
  has_rows boolean;
BEGIN
  FOREACH legacy_table IN ARRAY ARRAY[
    'birth_giving_assignments',
    'birth_giving_email_deliveries',
    'birth_giving_event_organizers',
    'birth_giving_events',
    'birth_giving_looking_for_team',
    'birth_giving_reflections',
    'birth_giving_storage_cleanup_claims',
    'birth_giving_team_members',
    'birth_giving_team_proposals',
    'birth_giving_team_result_files',
    'birth_giving_teams'
  ]
  LOOP
    -- Idempotent: skip tables that no longer exist so the guard can rerun
    -- safely when a later run re-applies the retirement.
    IF EXISTS (
      SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = legacy_table
         AND c.relkind IN ('r', 'p')
    ) THEN
      -- Block concurrent writers before checking emptiness so no row can be
      -- inserted between the check and the destructive drops below. The lock
      -- is held for the whole transaction (ACCESS EXCLUSIVE).
      EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', legacy_table);

      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM public.%I LIMIT 1)',
        legacy_table
      ) INTO has_rows;

      IF has_rows THEN
        RAISE EXCEPTION
          'Birth Giving simplification requires empty legacy tables; %.% contains data',
          'public',
          legacy_table;
      END IF;
    END IF;
  END LOOP;
END
$$;--> statement-breakpoint
ALTER TYPE "public"."birth_giving_assignment_state" ADD VALUE 'none';--> statement-breakpoint
DROP POLICY IF EXISTS "Community can view released BG assignments" ON "birth_giving_assignments" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG organizers can insert assignments" ON "birth_giving_assignments" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG organizers can update assignments" ON "birth_giving_assignments" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG assignments cannot be directly deleted" ON "birth_giving_assignments" CASCADE;--> statement-breakpoint
DROP TABLE "birth_giving_assignments" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG delivery outbox is private" ON "birth_giving_email_deliveries" CASCADE;--> statement-breakpoint
DROP TABLE "birth_giving_email_deliveries" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG organizers can view their organizer rows" ON "birth_giving_event_organizers" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG organizer changes use lifecycle RPCs" ON "birth_giving_event_organizers" CASCADE;--> statement-breakpoint
DROP TABLE "birth_giving_event_organizers" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Verified community can view published BG events" ON "birth_giving_events" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Profiles can create BG event drafts" ON "birth_giving_events" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG organizers can update events" ON "birth_giving_events" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG events cannot be directly deleted" ON "birth_giving_events" CASCADE;--> statement-breakpoint
DROP TABLE "birth_giving_events" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Community can view BG team searches" ON "birth_giving_looking_for_team" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Profiles can start their own BG team search" ON "birth_giving_looking_for_team" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Profiles can update their own BG team search" ON "birth_giving_looking_for_team" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Profiles can stop their own BG team search" ON "birth_giving_looking_for_team" CASCADE;--> statement-breakpoint
DROP TABLE "birth_giving_looking_for_team" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Community can view published BG reflections" ON "birth_giving_reflections" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Participants can create their BG reflections" ON "birth_giving_reflections" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Participants can update their BG reflections" ON "birth_giving_reflections" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG reflections cannot be directly deleted" ON "birth_giving_reflections" CASCADE;--> statement-breakpoint
DROP TABLE "birth_giving_reflections" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG storage cleanup claims are private" ON "birth_giving_storage_cleanup_claims" CASCADE;--> statement-breakpoint
DROP TABLE "birth_giving_storage_cleanup_claims" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Community can view published BG memberships" ON "birth_giving_team_members" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG membership changes use lifecycle RPCs" ON "birth_giving_team_members" CASCADE;--> statement-breakpoint
DROP TABLE "birth_giving_team_members" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Profiles can view relevant BG proposals" ON "birth_giving_team_proposals" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG proposal changes use lifecycle RPCs" ON "birth_giving_team_proposals" CASCADE;--> statement-breakpoint
DROP TABLE "birth_giving_team_proposals" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Community can view published BG result files" ON "birth_giving_team_result_files" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG members and organizers can insert result files" ON "birth_giving_team_result_files" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG members and organizers can update result files" ON "birth_giving_team_result_files" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG result files cannot be directly deleted" ON "birth_giving_team_result_files" CASCADE;--> statement-breakpoint
DROP TABLE "birth_giving_team_result_files" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "Community can view published BG teams" ON "birth_giving_teams" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG organizers can insert teams" ON "birth_giving_teams" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG organizers can update teams" ON "birth_giving_teams" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "BG teams cannot be directly deleted" ON "birth_giving_teams" CASCADE;--> statement-breakpoint
DROP TABLE "birth_giving_teams" CASCADE;