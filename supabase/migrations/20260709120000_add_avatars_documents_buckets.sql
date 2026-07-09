-- Split storage into per-purpose buckets:
--   avatars   (public)  — profile + team pictures
--   documents (private) — future user documents, served via signed URLs
-- The existing 'images' bucket (public) keeps book covers + essay content images.
--
-- Private buckets need no storage.objects RLS policies here: all access is
-- mediated server-side (service role for writes, signed URLs for reads), which
-- bypasses RLS. Add per-feature policies when the documents feature lands.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('documents', 'documents', false, null, null)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
