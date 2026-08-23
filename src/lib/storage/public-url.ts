import { BUCKETS, type BucketId } from './buckets';

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321').replace(/\/$/, '');
}

function encodeStorageKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

/**
 * Public object URL for a key in a public bucket.
 * Only valid for buckets with `public: true`; private buckets must be read
 * via server-generated signed URLs (see getSignedStorageUrl in service.ts).
 */
export function getPublicStorageUrl(bucket: BucketId, key: string): string {
  return `${baseUrl()}/storage/v1/object/public/${BUCKETS[bucket].name}/${encodeStorageKey(key)}`;
}

export interface TransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'origin' | 'webp' | 'avif';
  resize?: 'contain' | 'cover' | 'fill';
}

export interface ImageRendition {
  width: number;
  height?: number;
}

export function getTransformedImageUrl(
  bucket: BucketId,
  key: string,
  opts: TransformOptions,
): string {
  const params = new URLSearchParams();
  if (opts.width) params.set('width', String(opts.width));
  if (opts.height) params.set('height', String(opts.height));
  if (opts.quality) params.set('quality', String(opts.quality));
  if (opts.format) params.set('format', opts.format);
  if (opts.resize) params.set('resize', opts.resize);
  const qs = params.toString();
  return `${baseUrl()}/storage/v1/render/image/public/${BUCKETS[bucket].name}/${encodeStorageKey(key)}${qs ? '?' + qs : ''}`;
}

export function getTransformedImageSrcSet(
  bucket: BucketId,
  key: string,
  renditions: readonly ImageRendition[],
  opts: Omit<TransformOptions, 'width' | 'height'>,
): string {
  return renditions
    .map(({ width, height }) => (
      `${getTransformedImageUrl(bucket, key, { ...opts, width, height })} ${width}w`
    ))
    .join(', ');
}

export function isExternalUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://');
}

/**
 * Resolve a stored avatar reference to a renderable URL.
 * `profiles.picture` (and `teams.picture`) store either a storage key in the
 * `avatars` bucket (e.g. `profile/{id}/{ts}-{uuid}.webp`) or an external URL
 * (e.g. Google OAuth avatar). Always run raw refs through this before passing
 * them to an `<img>`/`<Image>` `src`, otherwise the browser requests the key
 * as a relative path and the avatar silently fails to load.
 */
export function getAvatarUrl(
  storageKey: string | null | undefined,
): string | null {
  if (!storageKey) return null;
  return isExternalUrl(storageKey)
    ? storageKey
    : getPublicStorageUrl('avatars', storageKey);
}
