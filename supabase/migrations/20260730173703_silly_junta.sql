CREATE TABLE "book_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_book_id" uuid NOT NULL,
	"borrower_id" uuid NOT NULL,
	"borrowed_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"returned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_loans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"isbn_13" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"updated_by_profile_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_books" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_library_book_id_fkey" FOREIGN KEY ("library_book_id") REFERENCES "public"."library_books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_loans_library_book_id_idx" ON "book_loans" USING btree ("library_book_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "book_loans_borrower_id_idx" ON "book_loans" USING btree ("borrower_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "book_loans_active_idx" ON "book_loans" USING btree ("library_book_id" uuid_ops) WHERE (returned_at IS NULL);--> statement-breakpoint
CREATE INDEX "library_books_book_id_idx" ON "library_books" USING btree ("book_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "library_books_isbn_13_idx" ON "library_books" USING btree ("isbn_13" text_ops) WHERE (isbn_13 IS NOT NULL);--> statement-breakpoint
CREATE POLICY "Authenticated users can view loans" ON "book_loans" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Users can borrow for themselves" ON "book_loans" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((borrower_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Borrower can return their own loan" ON "book_loans" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((borrower_id = current_profile_id())) WITH CHECK ((borrower_id = current_profile_id()));--> statement-breakpoint
CREATE POLICY "Authenticated users can view library books" ON "library_books" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Coaches and admins can add library books" ON "library_books" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can update library books" ON "library_books" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_coach_or_admin()) WITH CHECK (is_coach_or_admin());--> statement-breakpoint
CREATE POLICY "Coaches and admins can delete library books" ON "library_books" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_coach_or_admin());