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
 * Get file extension from MIME type
 */
export function getFileExtension(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[contentType] || "jpg";
}
