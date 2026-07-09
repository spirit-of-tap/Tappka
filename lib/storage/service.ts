import { createAdminClient } from "@/lib/supabase/admin";
import type { UploadOptions, PresignedUploadData } from "./types";
import { randomUUID } from "crypto";

const BUCKET_NAME = process.env.SUPABASE_S3_BUCKET ?? 'images';
const PRESIGN_EXPIRY_SECONDS = 900;

export async function generatePresignedUpload(
  options: UploadOptions
): Promise<PresignedUploadData> {
  const supabase = createAdminClient();

  const timestamp = Date.now();
  const uuid = randomUUID();
  const key = `${options.context}/${options.entityId}/${timestamp}-${uuid}.${options.fileExtension}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
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

export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(key, buffer, { contentType, upsert: true });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return key;
}

export async function deleteFile(key: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([key]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
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
    await uploadFile(key, buffer, contentType);
    return key;
  } catch {
    return null;
  }
}
