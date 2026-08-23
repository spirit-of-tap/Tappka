-- Rename Enum
ALTER TYPE "public"."semester_reflection_topic" RENAME TO "annual_reflection_topic";

-- Rename Tables
ALTER TABLE "public"."team_semester_reflections" RENAME TO "team_annual_reflections";
ALTER TABLE "public"."team_semester_reflection_entries" RENAME TO "team_annual_reflection_entries";

-- Rename Columns
ALTER TABLE "public"."team_annual_reflections" RENAME COLUMN "semester_month" TO "reflection_month";
ALTER TABLE "public"."team_annual_reflection_entries" RENAME COLUMN "semester_reflection_id" TO "annual_reflection_id";

-- Update Check Constraint on Month (only May = 5 allowed)
ALTER TABLE "public"."team_annual_reflections" DROP CONSTRAINT IF EXISTS "team_semester_reflections_month_check";
ALTER TABLE "public"."team_annual_reflections" ADD CONSTRAINT "team_annual_reflections_month_check" CHECK (EXTRACT(MONTH FROM reflection_month) = 5);

-- Rename Foreign Keys and Indexes
ALTER TABLE "public"."team_annual_reflections" RENAME CONSTRAINT "team_semester_reflections_team_id_fkey" TO "team_annual_reflections_team_id_fkey";
ALTER TABLE "public"."team_annual_reflections" RENAME CONSTRAINT "team_semester_reflections_created_by_profile_id_fkey" TO "team_annual_reflections_created_by_profile_id_fkey";
ALTER TABLE "public"."team_annual_reflections" RENAME CONSTRAINT "team_semester_reflections_updated_by_profile_id_fkey" TO "team_annual_reflections_updated_by_profile_id_fkey";
ALTER INDEX IF EXISTS "team_semester_reflections_team_month_idx" RENAME TO "team_annual_reflections_team_month_idx";

ALTER TABLE "public"."team_annual_reflection_entries" RENAME CONSTRAINT "team_semester_reflection_entries_semester_reflection_id_fkey" TO "team_annual_reflection_entries_annual_reflection_id_fkey";
ALTER TABLE "public"."team_annual_reflection_entries" RENAME CONSTRAINT "team_semester_reflection_entries_updated_by_profile_id_fkey" TO "team_annual_reflection_entries_updated_by_profile_id_fkey";
ALTER INDEX IF EXISTS "team_semester_reflection_entries_reflection_topic_idx" RENAME TO "team_annual_reflection_entries_reflection_topic_idx";
ALTER INDEX IF EXISTS "team_semester_reflection_entries_reflection_idx" RENAME TO "team_annual_reflection_entries_reflection_idx";

-- Update RLS Policies on team_annual_reflections
DROP POLICY IF EXISTS "Team members can view semester reflections" ON "public"."team_annual_reflections";
DROP POLICY IF EXISTS "Team members can create semester reflections" ON "public"."team_annual_reflections";
DROP POLICY IF EXISTS "Team members can update semester reflections" ON "public"."team_annual_reflections";
DROP POLICY IF EXISTS "Team members can delete semester reflections" ON "public"."team_annual_reflections";

CREATE POLICY "Team members can view annual reflections" ON "public"."team_annual_reflections" AS PERMISSIVE FOR SELECT TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));
CREATE POLICY "Team members can create annual reflections" ON "public"."team_annual_reflections" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));
CREATE POLICY "Team members can update annual reflections" ON "public"."team_annual_reflections" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)) WITH CHECK (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));
CREATE POLICY "Team members can delete annual reflections" ON "public"."team_annual_reflections" AS PERMISSIVE FOR DELETE TO "authenticated" USING (team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL));

-- Update RLS Policies on team_annual_reflection_entries
DROP POLICY IF EXISTS "Team members can view semester reflection entries" ON "public"."team_annual_reflection_entries";
DROP POLICY IF EXISTS "Team members can create semester reflection entries" ON "public"."team_annual_reflection_entries";
DROP POLICY IF EXISTS "Team members can update semester reflection entries" ON "public"."team_annual_reflection_entries";
DROP POLICY IF EXISTS "Team members can delete semester reflection entries" ON "public"."team_annual_reflection_entries";

CREATE POLICY "Team members can view annual reflection entries" ON "public"."team_annual_reflection_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (annual_reflection_id IN (SELECT id FROM team_annual_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));
CREATE POLICY "Team members can create annual reflection entries" ON "public"."team_annual_reflection_entries" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (annual_reflection_id IN (SELECT id FROM team_annual_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));
CREATE POLICY "Team members can update annual reflection entries" ON "public"."team_annual_reflection_entries" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (annual_reflection_id IN (SELECT id FROM team_annual_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL))) WITH CHECK (annual_reflection_id IN (SELECT id FROM team_annual_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));
CREATE POLICY "Team members can delete annual reflection entries" ON "public"."team_annual_reflection_entries" AS PERMISSIVE FOR DELETE TO "authenticated" USING (annual_reflection_id IN (SELECT id FROM team_annual_reflections WHERE team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)));
