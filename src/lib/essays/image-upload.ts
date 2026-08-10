/**
 * Preparing and uploading an image dropped into an essay.
 *
 * Optimization happens in the browser, before the bytes ever leave: a phone
 * photo is typically 8–15 MB of 4000px JPEG, and storing that to show it at
 * 700px wide wastes the author's data and everyone's load time. What the picker
 * accepts is therefore much larger than what gets stored.
 */

import { optimizeImageToFit } from '@/lib/storage/image-optimizer';

/** What the picker accepts, before optimization shrinks it. */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
/** GIFs skip optimization to keep their animation, so they get a tighter cap. */
export const MAX_GIF_BYTES = 5 * 1024 * 1024;

const OPTIMIZATION = {
  maxEdge: 1600,
  quality: 0.82,
  format: 'image/webp',
} as const;

const UPLOAD_ENDPOINT = '/api/essays/upload-image';
const GIF_TYPE = 'image/gif';

function megabytes(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}

/**
 * Returns the message to show the author, or null when the file is usable.
 * Checked before upload so an oversized photo fails instantly instead of after
 * a long transfer.
 */
export function validateEssayImage(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Vlož obrázek — podporujeme JPEG, PNG, WebP a GIF.';
  }
  if (file.type === GIF_TYPE) {
    return file.size > MAX_GIF_BYTES
      ? `GIF může mít nejvýš ${megabytes(MAX_GIF_BYTES)} MB.`
      : null;
  }
  return file.size > MAX_ORIGINAL_BYTES
    ? `Obrázek může mít nejvýš ${megabytes(MAX_ORIGINAL_BYTES)} MB.`
    : null;
}

/**
 * Shrinks the file for the web. A GIF passes through untouched, because drawing
 * it to a canvas would silently flatten the animation to its first frame. If
 * the browser cannot decode the file at all (an odd HEIC, a corrupt header) the
 * original is returned and the server has the final say on the format.
 */
export async function prepareEssayImage(file: File): Promise<File> {
  if (file.type === GIF_TYPE) return file;

  try {
    return await optimizeImageToFit(file, OPTIMIZATION);
  } catch {
    return file;
  }
}

/**
 * Uploads one image and resolves its public URL.
 *
 * Uses XMLHttpRequest rather than fetch: fetch cannot report upload progress,
 * and a photo on a phone connection needs to show that something is happening.
 */
export function uploadEssayImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('file', file);

    const request = new XMLHttpRequest();
    request.open('POST', UPLOAD_ENDPOINT);

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    });

    request.addEventListener('load', () => {
      let payload: { src?: string; error?: string } = {};
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        // Keep the generic message below; a non-JSON body tells us nothing.
      }

      if (request.status >= 200 && request.status < 300 && payload.src) {
        resolve(payload.src);
        return;
      }
      reject(new Error(payload.error ?? 'Nahrání obrázku selhalo.'));
    });

    request.addEventListener('error', () =>
      reject(new Error('Nahrání obrázku selhalo. Zkontroluj připojení.')),
    );
    request.addEventListener('abort', () => reject(new Error('Nahrávání zrušeno.')));

    request.send(body);
  });
}
