/**
 * File validation utilities for storage uploads
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// Max size for original uploads (before optimization)
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Expected size after optimization (512x512 WebP at 85% quality)
// Typically 50-200KB depending on image complexity
export const EXPECTED_OPTIMIZED_SIZE = 200 * 1024; // 200KB

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

// Max size for personality test uploads (PDF reports with graphics)
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20MB

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate image upload constraints
 */
export function validateImageUpload(
  contentType: string,
  fileSize: number
): ValidationError | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    return {
      field: "contentType",
      message: "Povolené formáty: JPEG, PNG, WebP",
    };
  }

  if (fileSize > MAX_FILE_SIZE) {
    return {
      field: "fileSize",
      message: `Maximální velikost souboru je ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return null;
}

/**
 * Validate personality test upload constraints
 */
export function validatePersonalityTestUpload(
  contentType: string,
  fileSize: number
): ValidationError | null {
  if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(contentType)) {
    return {
      field: "contentType",
      message: "Povolené formáty: PDF, PNG, JPEG, WebP",
    };
  }

  if (fileSize > MAX_DOCUMENT_SIZE) {
    return {
      field: "fileSize",
      message: `Maximální velikost souboru je ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB`,
    };
  }

  return null;
}

/**
 * Validate versioned team documents, which deliberately support PDF only.
 */
export function validateTeamDocumentUpload(
  contentType: string,
  fileSize: number
): ValidationError | null {
  if (contentType !== "application/pdf") {
    return {
      field: "contentType",
      message: "Povolený formát: PDF",
    };
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_DOCUMENT_SIZE) {
    return {
      field: "fileSize",
      message: `Maximální velikost souboru je ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB`,
    };
  }

  return null;
}

/**
 * Get file extension from MIME type
 */
export function getFileExtension(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  return map[contentType] || "jpg";
}
