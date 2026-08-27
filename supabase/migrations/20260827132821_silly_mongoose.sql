CREATE TYPE "public"."beta_cohort" AS ENUM('A', 'B');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "beta_cohort" "beta_cohort" DEFAULT 'A' NOT NULL;