ALTER TABLE "essays" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "essays" ADD COLUMN "pinned_at" timestamp with time zone;