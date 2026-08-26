import { z } from "zod";

const MAX_EVENT_NAME_LENGTH = 160;
const MAX_CUSTOMER_LENGTH = 160;
const MAX_TEAM_NAME_LENGTH = 120;
const MAX_REFLECTION_LENGTH = 5_000;

const trimmedText = (maximumLength: number) =>
  z.string().trim().min(1).max(maximumLength);

const distinctUuidArray = z
  .array(z.string().uuid())
  .min(1)
  .refine((values) => new Set(values).size === values.length, {
    message: "Identifikátory se nesmí opakovat",
  });

// Team membership may be empty (a solo team), unlike organizer pickers which
// always include the caller among at least one organizer.
const distinctUuidArrayAllowEmpty = z
  .array(z.string().uuid())
  .refine((values) => new Set(values).size === values.length, {
    message: "Identifikátory se nesmí opakovat",
  });

// Event lifecycle fields (status, assignment metadata) are owned exclusively by
// dedicated RPCs and their routes; mutation payloads must never carry them.
export const birthGivingEventCreateSchema = z
  .object({
    name: trimmedText(MAX_EVENT_NAME_LENGTH),
    customer: trimmedText(MAX_CUSTOMER_LENGTH),
    startsAt: z.string().datetime({ offset: true }),
    duration: z.enum(["8h", "24h"]),
    organizerProfileIds: distinctUuidArray,
  })
  .strict();

export const birthGivingEventPatchSchema = z
  .object({
    name: trimmedText(MAX_EVENT_NAME_LENGTH).optional(),
    customer: trimmedText(MAX_CUSTOMER_LENGTH).optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
    duration: z.enum(["8h", "24h"]).optional(),
    organizerProfileIds: distinctUuidArray.optional(),
  })
  .strict();

export const birthGivingTeamCreateSchema = z.object({
  name: trimmedText(MAX_TEAM_NAME_LENGTH),
  memberProfileIds: distinctUuidArrayAllowEmpty.default([]),
});

export const birthGivingTeamUpdateSchema = z.object({
  name: trimmedText(MAX_TEAM_NAME_LENGTH).optional(),
  isWinner: z.boolean().optional(),
  memberProfileIds: distinctUuidArrayAllowEmpty.optional(),
});

export const birthGivingResultFileAddSchema = z.object({
  storagePath: z.string().min(1),
  originalFileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().min(0),
});

export const birthGivingReflectionSchema = z.object({
  contribution: trimmedText(MAX_REFLECTION_LENGTH),
  learning: trimmedText(MAX_REFLECTION_LENGTH),
});

export interface BirthGivingPostgresError {
  code: string;
  message: string;
  details: string;
  hint: string;
}

export const BIRTH_GIVING_ERROR_CODES = {
  duplicateEvent: "DUPLICATE_EVENT",
  unauthorized: "UNAUTHORIZED",
  notFound: "NOT_FOUND",
  invalidRelation: "INVALID_RELATION",
  invalidState: "INVALID_STATE",
  invalidId: "INVALID_ID",
  invalidPayload: "INVALID_PAYLOAD",
} as const;

export interface BirthGivingApiError {
  code: (typeof BIRTH_GIVING_ERROR_CODES)[keyof typeof BIRTH_GIVING_ERROR_CODES];
  message: string;
  status: 403 | 404 | 409;
}

/**
 * Maps stable PostgreSQL SQLSTATE error codes raised by the Birth Giving
 * mutation/reporting RPCs to consistent Czech API responses (inclusive,
 * gender-neutral, present tense). Unknown codes return null so callers can
 * fall back to a generic 500.
 */
export function mapBirthGivingPostgresError(
  error: BirthGivingPostgresError,
): BirthGivingApiError | null {
  switch (error.code) {
    case "42501":
      return {
        code: BIRTH_GIVING_ERROR_CODES.unauthorized,
        message: "K provedení této akce nemáte oprávnění.",
        status: 403,
      };
    case "P0002":
      return {
        code: BIRTH_GIVING_ERROR_CODES.notFound,
        message: "Požadovaná událost nebo tým neexistují.",
        status: 404,
      };
    case "23505":
      return {
        code: BIRTH_GIVING_ERROR_CODES.duplicateEvent,
        message: "Stejná Birth Giving událost už existuje.",
        status: 409,
      };
    case "23503":
      return {
        code: BIRTH_GIVING_ERROR_CODES.invalidRelation,
        message: "Požadovaná vazba není pro tuto událost platná.",
        status: 409,
      };
    case "23514":
      return {
        code: BIRTH_GIVING_ERROR_CODES.invalidState,
        message: "Požadovaná akce není v aktuálním stavu události možná.",
        status: 409,
      };
    default:
      return null;
  }
}
