CREATE TABLE "book_wishlist" (
	"profile_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_wishlist_pkey" PRIMARY KEY("profile_id","book_id")
);
--> statement-breakpoint
ALTER TABLE "book_wishlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "book_wishlist" ADD CONSTRAINT "book_wishlist_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_wishlist" ADD CONSTRAINT "book_wishlist_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_wishlist_profile_created_idx" ON "book_wishlist" USING btree ("profile_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE POLICY "Users can view their own book wishlist" ON "book_wishlist" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can add to their own book wishlist" ON "book_wishlist" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((profile_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Users can remove from their own book wishlist" ON "book_wishlist" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((profile_id = current_profile_id()));