import { createAdminClient } from "@/lib/supabase/admin";
import type { UploadOptions, PresignedUploadData } from "./types";
import { BUCKETS, type BucketId, contextToBucket } from "./buckets";
import { randomUUID } from "crypto";

const PRESIGN_EXPIRY_SECONDS = 900;
const SIGNED_DOWNLOAD_EXPIRY_SECONDS = 3600;

export interface StoredObjectMetadata {
  size: number;
  contentType: string;
}

export async function generatePresignedUpload(
  options: UploadOptions
): Promise<PresignedUploadData> {
  const supabase = createAdminClient();
  const bucket = contextToBucket(options.context);

  const timestamp = Date.now();
  const uuid = randomUUID();
  const key = `${options.context}/${options.entityId}/${timestamp}-${uuid}.${options.fileExtension}`;

  const { data, error } = await supabase.storage
    .from(BUCKETS[bucket].name)
    .createSignedUploadUrl(key);

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  return {
    url: data.signedUrl,
    fields: {},
    key,
    expiresAt: new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000),
  };
}

export async function generatePresignedUploadForKey(
  bucket: BucketId,
  key: string,
): Promise<PresignedUploadData> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(BUCKETS[bucket].name).createSignedUploadUrl(key);
  if (error || !data) throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  return {
    url: data.signedUrl,
    fields: {},
    key,
    expiresAt: new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000),
  };
}

export async function inspectStorageObject(
  bucket: BucketId,
  key: string,
): Promise<StoredObjectMetadata | null> {
  const separator = key.lastIndexOf("/");
  const folder = separator === -1 ? "" : key.slice(0, separator);
  const name = key.slice(separator + 1);
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(BUCKETS[bucket].name).list(folder, {
    limit: 2,
    search: name,
  });
  if (error) throw new Error(`Failed to inspect storage object: ${error.message}`);
  const object = data.find((candidate) => candidate.name === name);
  if (!object) return null;
  const size = object.metadata?.size;
  const contentType = object.metadata?.mimetype;
  return typeof size === "number" && typeof contentType === "string"
    ? { size, contentType: contentType.split(";")[0].trim() }
    : null;
}

export async function uploadFile(
  bucket: BucketId,
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(BUCKETS[bucket].name)
    .upload(key, buffer, { contentType, upsert: true });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return key;
}

export async function deleteFile(bucket: BucketId, key: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(BUCKETS[bucket].name)
    .remove([key]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Time-limited signed download URL for objects in a private bucket
 * (e.g. documents). Must be generated server-side (uses the service role).
 */
export async function getSignedStorageUrl(
  bucket: BucketId,
  key: string,
  expiresIn: number = SIGNED_DOWNLOAD_EXPIRY_SECONDS
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(BUCKETS[bucket].name)
    .createSignedUrl(key, expiresIn);

  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }

  return data.signedUrl;
}

export function generateFileKey(
  context: string,
  entityId: string,
  fileExtension: string
): string {
  const timestamp = Date.now();
  const uuid = randomUUID();
  return `${context}/${entityId}/${timestamp}-${uuid}.${fileExtension}`;
}

export function generatePrivateStorageKey(prefix: string, fileExtension: string): string {
  return `${prefix}${randomUUID()}.${fileExtension}`;
}

const ALLOWED_COVER_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_COVER_BYTES = 2 * 1024 * 1024;

export async function downloadAndStoreCover(
  coverUrl: string,
  bookId: string,
): Promise<string | null> {
  try {
    const res = await fetch(coverUrl);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    const ext = ALLOWED_COVER_TYPES[contentType];
    if (!ext) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_COVER_BYTES) return null;

    const key = generateFileKey('book', bookId, ext);
    await uploadFile('images', key, buffer, contentType);
    return key;
  } catch {
    return null;
  }
}
