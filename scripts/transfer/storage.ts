import { IMAGES_BUCKET, type Endpoint } from "./config";

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
} as const;

const FALLBACK_CONTENT_TYPE = "application/octet-stream";

export interface ObjectHead {
  readonly exists: boolean;
  readonly size: number | null;
}

export function encodeObjectPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function contentTypeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return FALLBACK_CONTENT_TYPE;
  const extension = path.slice(dot).toLowerCase();
  return CONTENT_TYPES[extension as keyof typeof CONTENT_TYPES] ?? FALLBACK_CONTENT_TYPE;
}

/**
 * Supabase storage answers a missing public object with HTTP 400, not 404, so
 * anything other than 200 counts as absent.
 */
export async function headObject(endpoint: Endpoint, path: string): Promise<ObjectHead> {
  const response = await fetch(`${endpoint.publicImagePrefix}/${encodeObjectPath(path)}`, {
    method: "HEAD",
  });
  if (!response.ok) return { exists: false, size: null };

  const length = response.headers.get("content-length");
  return { exists: true, size: length === null ? null : Number(length) };
}

export async function downloadObject(
  endpoint: Endpoint,
  path: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await fetch(`${endpoint.publicImagePrefix}/${encodeObjectPath(path)}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GET object ${path} failed: ${response.status} ${body}`);
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? contentTypeFor(path),
  };
}

export async function uploadObject(
  endpoint: Endpoint,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const response = await fetch(
    `${endpoint.storageApiUrl}/object/${IMAGES_BUCKET}/${encodeObjectPath(path)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.serviceKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes.buffer as ArrayBuffer,
    },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`PUT object ${path} failed: ${response.status} ${body}`);
  }
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
