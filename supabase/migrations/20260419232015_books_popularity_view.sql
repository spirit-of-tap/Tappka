-- View that includes pre-computed essay_count per book for efficient popularity sorting.
-- security_invoker means RLS policies from the underlying books/essays tables apply.
create or replace view public.books_with_essay_count
  with (security_invoker = on)
as
select
  b.*,
  coalesce(ec.essay_count, 0) as essay_count
from public.books b
left join (
  select book_id, count(*)::integer as essay_count
  from public.essays
  where book_id is not null
  group by book_id
) ec on ec.book_id = b.id;
