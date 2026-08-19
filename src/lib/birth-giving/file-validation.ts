import {
  BIRTH_GIVING_MAX_FILE_SIZE_BYTES,
  BIRTH_GIVING_MAX_TEAM_RESULT_TOTAL_SIZE_BYTES,
} from "./constants";

export const ALLOWED_BIRTH_GIVING_FILE_TYPES = {
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "pptx",
  ],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "docx",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
} as const;

const UNSAFE_FILE_EXTENSIONS = new Set([
  "bat",
  "cmd",
  "com",
  "exe",
  "html",
  "htm",
  "js",
  "mjs",
  "ps1",
  "scr",
  "sh",
  "svg",
]);

export interface BirthGivingFileInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface BirthGivingFileValidationError {
  code:
    | "unsupported_type"
    | "invalid_extension"
    | "empty_file"
    | "file_too_large"
    | "team_total_too_large";
}

export function validateBirthGivingFile(
  input: BirthGivingFileInput,
): BirthGivingFileValidationError | null {
  if (!isAllowedMimeType(input.mimeType)) {
    return { code: "unsupported_type" };
  }

  const extensions = input.fileName.toLowerCase().split(".").slice(1);
  const extension = extensions.at(-1);
  const allowedExtensions = ALLOWED_BIRTH_GIVING_FILE_TYPES[input.mimeType];

  if (
    extension === undefined ||
    extensions.some((part) => UNSAFE_FILE_EXTENSIONS.has(part)) ||
    !(allowedExtensions as readonly string[]).includes(extension)
  ) {
    return { code: "invalid_extension" };
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { code: "empty_file" };
  }

  if (input.sizeBytes > BIRTH_GIVING_MAX_FILE_SIZE_BYTES) {
    return { code: "file_too_large" };
  }

  return null;
}

export function validateBirthGivingResultFile(
  input: BirthGivingFileInput,
  currentTotalSizeBytes: number,
): BirthGivingFileValidationError | null {
  const fileError = validateBirthGivingFile(input);

  if (fileError !== null) {
    return fileError;
  }

  if (
    currentTotalSizeBytes + input.sizeBytes >
    BIRTH_GIVING_MAX_TEAM_RESULT_TOTAL_SIZE_BYTES
  ) {
    return { code: "team_total_too_large" };
  }

  return null;
}

function isAllowedMimeType(
  mimeType: string,
): mimeType is keyof typeof ALLOWED_BIRTH_GIVING_FILE_TYPES {
  return Object.hasOwn(ALLOWED_BIRTH_GIVING_FILE_TYPES, mimeType);
}
