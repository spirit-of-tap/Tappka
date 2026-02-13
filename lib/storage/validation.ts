/**
 * File validation utilities for storage uploads
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain",
] as const;

// Max size for document uploads (prep files)
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20MB

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
  if (!ALLOWED_IMAGE_TYPES.includes(contentType as any)) {
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
 * Validate document upload constraints (for prep files)
 */
export function validateDocumentUpload(
  contentType: string,
  fileSize: number
): ValidationError | null {
  if (!ALLOWED_DOCUMENT_TYPES.includes(contentType as any)) {
    return {
      field: "contentType",
      message: "Povolené formáty: PDF, DOCX, TXT",
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

/**
 * Get file extension from MIME type for documents
 */
export function getDocumentExtension(contentType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
  };
  return map[contentType] || "pdf";
}
