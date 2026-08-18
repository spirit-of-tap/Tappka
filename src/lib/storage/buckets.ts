/**
 * Storage bucket registry — single source of truth for which buckets exist,
 * whether they are public, and which upload context maps to which bucket.
 *
 * Public buckets are read via public object URLs (see public-url.ts).
 * Private buckets must be read via server-generated signed URLs
 * (see getSignedStorageUrl in service.ts).
 *
 * This module is safe to import from client components: it holds only
 * constants and pure functions, no server-only dependencies.
 */

import type { StorageContext } from "./types";

export interface BucketConfig {
  name: string;
  public: boolean;
}

export const BUCKETS = {
  avatars: { name: "avatars", public: true }, // profile + team pictures
  images: { name: "images", public: true }, // book covers + essay content images
  documents: { name: "documents", public: false }, // user documents (signed URLs)
} as const satisfies Record<string, BucketConfig>;

export type BucketId = keyof typeof BUCKETS;

export function isPublicBucket(bucket: BucketId): boolean {
  return BUCKETS[bucket].public;
}

/** Maps a picture-upload context to the bucket its files live in. */
export function contextToBucket(context: StorageContext): BucketId {
  switch (context) {
    case "profile":
    case "team":
      return "avatars";
    case "book":
      return "images";
    case "personality-test":
      return "documents";
  }
}
