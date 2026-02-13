/**
 * Storage Types for Backblaze B2 Integration
 */

export type StorageContext = "profile" | "team" | "training-session-prep";

export interface UploadOptions {
  context: StorageContext;
  entityId: string; // profile ID or team ID
  contentType: string;
  fileExtension: string;
}

export interface PresignedUploadData {
  url: string;
  fields: Record<string, string>;
  key: string;
  expiresAt: Date;
}

export interface PresignedDownloadData {
  url: string;
  expiresAt: Date;
}

export interface FileMetadata {
  key: string;
  url: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
}
