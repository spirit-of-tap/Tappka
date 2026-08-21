import { z } from "zod";

import { BIRTH_GIVING_MAX_FILE_SIZE_BYTES } from "@/lib/birth-giving/constants";
import {
  ALLOWED_BIRTH_GIVING_FILE_TYPES,
  validateBirthGivingFile,
} from "@/lib/birth-giving/file-validation";

type BirthGivingMimeType = keyof typeof ALLOWED_BIRTH_GIVING_FILE_TYPES;

export const BIRTH_GIVING_FILE_ACCEPT = Object.entries(ALLOWED_BIRTH_GIVING_FILE_TYPES)
  .flatMap(([mimeType, extensions]) => [mimeType, ...extensions.map((extension) => `.${extension}`)])
  .join(",");

export const birthGivingFileSchema = z
  .object({
    originalFileName: z.string().trim().min(1).max(255),
    mimeType: z.enum(Object.keys(ALLOWED_BIRTH_GIVING_FILE_TYPES) as [BirthGivingMimeType, ...BirthGivingMimeType[]]),
    fileSize: z.number().int().positive().max(BIRTH_GIVING_MAX_FILE_SIZE_BYTES),
  })
  .strict()
  .refine(
    ({ originalFileName, mimeType, fileSize }) => validateBirthGivingFile({
      fileName: originalFileName,
      mimeType,
      sizeBytes: fileSize,
    }) === null,
    { message: "Přípona souboru neodpovídá jeho typu", path: ["originalFileName"] },
  );

export const birthGivingConfirmedFileSchema = birthGivingFileSchema.and(
  z.object({ storagePath: z.string().trim().min(1).max(1_024) }).strict(),
);

export function extensionForBirthGivingMimeType(mimeType: string): string | null {
  return ALLOWED_BIRTH_GIVING_FILE_TYPES[mimeType as BirthGivingMimeType]?.[0] ?? null;
}

export function assignmentStoragePrefix(eventId: string): string {
  return `birth-giving/assignments/${eventId}/`;
}

export function resultStoragePrefix(eventId: string, teamId: string): string {
  return `birth-giving/results/${eventId}/${teamId}/`;
}
