-- Custom SQL migration file, put your code below! --
-- Allow animated GIFs in essay content images. The essay upload route and
-- client validation already accept image/gif, but the storage bucket
-- allowlist rejected it, so GIF uploads failed with "Upload selhal".
--> statement-breakpoint
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    file_size_limit = 10485760
WHERE id = 'images';