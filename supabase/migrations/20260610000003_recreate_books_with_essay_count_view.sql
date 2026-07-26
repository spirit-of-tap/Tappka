-- Recreate view to include page_count and preview_link added in 20260610000002
DROP VIEW public.books_with_essay_count;
CREATE VIEW public.books_with_essay_count AS
SELECT b.id, b.title, b.author, b.isbn_13, b.description, b.cover_path,
       b.tags, b.suggested_points, b.book_points, b.status,
       b.added_by_profile_id, b.approved_by_profile_id, b.approved_at,
       b.rejection_reason, b.source, b.external_id,
       b.created_at, b.updated_at,
       b.page_count, b.preview_link,
       COALESCE(ec.essay_count, 0)::integer AS essay_count
FROM books b
LEFT JOIN (
  SELECT book_id, COUNT(*)::integer AS essay_count
  FROM essays
  WHERE book_id IS NOT NULL
  GROUP BY book_id
) ec ON ec.book_id = b.id;
