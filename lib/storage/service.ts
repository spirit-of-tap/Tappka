/**
 * Storage Service for Backblaze B2
 * 
 * Provides high-level operations for file storage using B2's S3-compatible API.
 * Supports private buckets with presigned URLs for secure access.
 */

import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getB2Client } from "./b2-client";
import type {
  UploadOptions,
  PresignedUploadData,
  PresignedDownloadData,
} from "./types";
import { randomUUID } from "crypto";

const BUCKET_NAME = process.env.B2_BUCKET_NAME!;
const PRESIGN_EXPIRY_SECONDS = 900; // 15 minutes for uploads
const DOWNLOAD_EXPIRY_SECONDS = 3600; // 1 hour for downloads

/**
 * Generate a presigned PUT URL for direct browser upload to B2
 * 
 * Note: B2's S3-compatible API may have issues with POST presigned URLs.
 * Using PUT is more reliable across S3-compatible providers.
 * 
 * @param options Upload configuration
 * @returns Presigned PUT URL and file key
 */
export async function generatePresignedUpload(
  options: UploadOptions
): Promise<PresignedUploadData> {
  const client = getB2Client();

  // Generate unique file key
  const timestamp = Date.now();
  const uuid = randomUUID();
  const key = `${options.context}/${options.entityId}/${timestamp}-${uuid}.${options.fileExtension}`;

  // Use presigned PUT instead of POST (more reliable for B2)
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: options.contentType,
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });

  return {
    url,
    fields: {}, // No fields needed for PUT
    key,
    expiresAt: new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000),
  };
}

/**
 * Generate a presigned GET URL for secure download from private bucket
 * 
 * @param key File key in B2
 * @returns Presigned download URL
 */
export async function generatePresignedDownload(
  key: string
): Promise<PresignedDownloadData> {
  const client = getB2Client();

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: DOWNLOAD_EXPIRY_SECONDS,
  });

  return {
    url,
    expiresAt: new Date(Date.now() + DOWNLOAD_EXPIRY_SECONDS * 1000),
  };
}

/**
 * Upload a file buffer directly (for server-side processing)
 * 
 * @param key File key in B2
 * @param buffer File data
 * @param contentType MIME type
 * @returns File key
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const client = getB2Client();

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);

  return key;
}

/**
 * Delete a file from B2
 * 
 * @param key File key in B2
 */
export async function deleteFile(key: string): Promise<void> {
  const client = getB2Client();

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await client.send(command);
}

/**
 * Generate file key for new upload
 *
 * @param context Storage context (profile/team/book)
 * @param entityId Profile, team, or book ID
 * @param fileExtension File extension
 * @returns Generated file key
 */
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
const MAX_COVER_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Download an external cover URL and store it in B2 under book/<bookId>/...
 * Returns the stored file key (cover_path), or null if download/validation fails.
 */
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
