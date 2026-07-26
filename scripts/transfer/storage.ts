import { IMAGES_BUCKET, publicObjectPrefix, type Endpoint } from "./config";

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
} as const;

const FALLBACK_CONTENT_TYPE = "application/octet-stream";

const MAX_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 500;

/**
 * Retries transient transport failures. Moving ~1.1 GB across 1746 objects hits
 * occasional connection resets, and a bare `fetch` rejection ("fetch failed")
 * carries no status — so without this a single blip aborts the whole run.
 * Only the transport is retried: an HTTP error response is the caller's to
 * interpret and is never retried here.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  what: string,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error: unknown) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${what} failed after ${MAX_ATTEMPTS} attempts: ${reason}`);
}

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
export async function headObject(
  endpoint: Endpoint,
  path: string,
  bucket: string = IMAGES_BUCKET,
): Promise<ObjectHead> {
  const response = await fetchWithRetry(
    `${publicObjectPrefix(endpoint, bucket)}/${encodeObjectPath(path)}`,
    { method: "HEAD" },
    `HEAD object ${path}`,
  );
  if (!response.ok) return { exists: false, size: null };

  const length = response.headers.get("content-length");
  return { exists: true, size: length === null ? null : Number(length) };
}

export async function downloadObject(
  endpoint: Endpoint,
  path: string,
  bucket: string = IMAGES_BUCKET,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string }> {
  const response = await fetchWithRetry(
    `${publicObjectPrefix(endpoint, bucket)}/${encodeObjectPath(path)}`,
    {},
    `GET object ${path}`,
  );
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
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
  bucket: string = IMAGES_BUCKET,
): Promise<void> {
  const response = await fetchWithRetry(
    `${endpoint.storageApiUrl}/object/${bucket}/${encodeObjectPath(path)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.serviceKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    },
    `PUT object ${path}`,
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
