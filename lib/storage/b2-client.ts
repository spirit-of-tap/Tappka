/**
 * Backblaze B2 S3-Compatible Client
 * 
 * This module provides a singleton S3Client configured for Backblaze B2.
 * Uses AWS SDK v3 with B2's S3-compatible API.
 */

import { S3Client } from "@aws-sdk/client-s3";

let b2Client: S3Client | null = null;

/**
 * Get or create B2 S3Client singleton
 * 
 * Configuration is loaded from environment variables:
 * - B2_KEY_ID: Your B2 application key ID
 * - B2_APPLICATION_KEY: Your B2 application key
 * - B2_ENDPOINT: B2 S3-compatible endpoint (e.g., https://s3.us-west-002.backblazeb2.com)
 * - B2_REGION: B2 region code (e.g., us-west-002)
 * 
 * @throws {Error} If required environment variables are missing
 */
export function getB2Client(): S3Client {
  if (!b2Client) {
    const keyId = process.env.B2_KEY_ID;
    const applicationKey = process.env.B2_APPLICATION_KEY;
    const endpoint = process.env.B2_ENDPOINT;
    const region = process.env.B2_REGION;

    if (!keyId || !applicationKey || !endpoint || !region) {
      throw new Error(
        "Missing required B2 environment variables. " +
        "Please set B2_KEY_ID, B2_APPLICATION_KEY, B2_ENDPOINT, and B2_REGION in .env.local"
      );
    }

    b2Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: applicationKey,
      },
      // Force path-style URLs (required for B2)
      forcePathStyle: true,
    });
  }

  return b2Client;
}

/**
 * Reset the client (useful for testing or reconfiguration)
 */
export function resetB2Client(): void {
  b2Client = null;
}
