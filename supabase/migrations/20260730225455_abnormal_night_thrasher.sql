DROP POLICY "Authors and admins can delete book comments" ON "book_comments" CASCADE;--> statement-breakpoint
DROP POLICY "Authors can update their own book comments" ON "book_comments" CASCADE;--> statement-breakpoint
DROP POLICY "Authenticated users can add book comments" ON "book_comments" CASCADE;--> statement-breakpoint
DROP POLICY "Authenticated users can view book comments" ON "book_comments" CASCADE;--> statement-breakpoint
DROP TABLE "book_comments" CASCADE;