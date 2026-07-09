const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? process.env.SUPABASE_S3_BUCKET ?? 'images'
  : 'images';

function baseUrl(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')}`;
}

export function getPublicStorageUrl(key: string): string {
  return `${baseUrl()}/storage/v1/object/public/${BUCKET}/${key}`;
}

export interface TransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'origin' | 'webp' | 'avif';
  resize?: 'contain' | 'cover' | 'fill';
}

export function getTransformedImageUrl(
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
  return `${baseUrl()}/storage/v1/render/image/public/${BUCKET}/${key}${qs ? '?' + qs : ''}`;
}

export function isExternalUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://');
}
