-- Allow coaches (and admins) to delete books, not just admins
drop policy if exists "Admins can delete books" on public.books;

create policy "Coaches and admins can delete books"
  on public.books for delete
  using (public.is_coach_or_admin());
