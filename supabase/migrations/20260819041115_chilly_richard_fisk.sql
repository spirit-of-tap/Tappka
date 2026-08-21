CREATE TABLE "birth_giving_storage_cleanup_claims" (
	"storage_path" text PRIMARY KEY NOT NULL,
	"claim_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "birth_giving_storage_cleanup_claims_claim_id_key" UNIQUE("claim_id"),
	CONSTRAINT "birth_giving_storage_cleanup_claims_attempt_count_check" CHECK (attempt_count >= 1)
);
--> statement-breakpoint
ALTER TABLE "birth_giving_storage_cleanup_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "BG storage cleanup claims are private" ON "birth_giving_storage_cleanup_claims" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);