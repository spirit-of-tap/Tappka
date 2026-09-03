DROP INDEX "library_books_isbn_13_idx";--> statement-breakpoint
ALTER TABLE "library_books" ADD COLUMN "label_code" integer;--> statement-breakpoint
ALTER TABLE "library_books" DROP COLUMN "isbn_13";--> statement-breakpoint
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_label_code_key" UNIQUE("label_code");--> statement-breakpoint
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_label_code_check" CHECK ((label_code IS NULL) OR (label_code > 0));