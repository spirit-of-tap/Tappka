DROP INDEX "team_reflections_team_month_idx";--> statement-breakpoint
DROP INDEX "team_semester_reflections_team_month_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "team_reflections_team_month_idx" ON "team_reflections" USING btree ("team_id" uuid_ops,"month" date_ops) WHERE (removed_at IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "team_semester_reflections_team_month_idx" ON "team_semester_reflections" USING btree ("team_id" uuid_ops,"semester_month" date_ops) WHERE (removed_at IS NULL);