-- Create storage buckets for user content (images, avatars, book covers)
-- The app serves objects via public object URLs (/storage/v1/object/public/...),
-- so the bucket must be public. Upsert keeps existing buckets in sync.

insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = excluded.public;
