import { z } from "zod"

import {
  TAG_NAME_MAX_LENGTH,
  TAG_NAME_MIN_LENGTH,
  TIME_DIRECTION_VALUES,
  TIME_TRACKING_MESSAGES,
  TITLE_MAX_LENGTH,
} from "./constants"

const END_BEFORE_START_MESSAGE = "Konec musí být po začátku"
const EMPTY_PATCH_MESSAGE = "Nic ke změně"

/** True when both are parseable instants and `end` is strictly after `start`. */
export function isValidTimeRange(startedAt: string, endedAt: string): boolean {
  const start = Date.parse(startedAt)
  const end = Date.parse(endedAt)
  return Number.isFinite(start) && Number.isFinite(end) && end > start
}

export const timeDirectionSchema = z.enum(TIME_DIRECTION_VALUES, { message: "Vyber směr" })

/** ISO 8601 instant with `Z` or an explicit offset. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true, message: "Neplatné datum a čas" })

/** Route `[id]` segment; anything that is not a UUID is treated as not found. */
export const idParamSchema = z.uuid()

export const tagIdSchema = z.uuid({ message: TIME_TRACKING_MESSAGES.invalidTag })

/** Trimmed title; empty string becomes `null`, `undefined` stays `undefined` (= unchanged). */
export const titleSchema = z
  .string()
  .trim()
  .max(TITLE_MAX_LENGTH, { message: `Název může mít nejvýš ${TITLE_MAX_LENGTH} znaků` })
  .nullable()
  .optional()
  .transform((value) => (value === "" ? null : value))

export const createEntrySchema = z
  .object({
    direction: timeDirectionSchema,
    tagId: tagIdSchema.nullable().optional(),
    title: titleSchema,
    startedAt: isoDateTimeSchema,
    endedAt: isoDateTimeSchema,
  })
  .refine((value) => isValidTimeRange(value.startedAt, value.endedAt), {
    message: END_BEFORE_START_MESSAGE,
    path: ["endedAt"],
  })

export type CreateEntryInput = z.infer<typeof createEntrySchema>

/**
 * Partial update. When only one of `startedAt` / `endedAt` is sent, the route must
 * re-check the range against the stored value.
 */
export const updateEntrySchema = z
  .object({
    direction: timeDirectionSchema.optional(),
    tagId: tagIdSchema.nullable().optional(),
    title: titleSchema,
    startedAt: isoDateTimeSchema.optional(),
    endedAt: isoDateTimeSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: EMPTY_PATCH_MESSAGE,
  })
  .refine(
    (value) =>
      value.startedAt === undefined || value.endedAt === undefined || isValidTimeRange(value.startedAt, value.endedAt),
    { message: END_BEFORE_START_MESSAGE, path: ["endedAt"] },
  )

export type UpdateEntryInput = z.infer<typeof updateEntrySchema>

export const startTimerSchema = z.object({
  action: z.literal("start"),
  direction: timeDirectionSchema,
  tagId: tagIdSchema.nullable().optional(),
  title: titleSchema,
})

export const stopTimerSchema = z.object({
  action: z.literal("stop"),
})

export const timerActionSchema = z.discriminatedUnion("action", [startTimerSchema, stopTimerSchema])

export type TimerActionInput = z.infer<typeof timerActionSchema>

export const tagNameSchema = z
  .string()
  .trim()
  .min(TAG_NAME_MIN_LENGTH, { message: "Zadej název tagu" })
  .max(TAG_NAME_MAX_LENGTH, { message: `Název tagu může mít nejvýš ${TAG_NAME_MAX_LENGTH} znaků` })

export const createTagSchema = z.object({ name: tagNameSchema })
export const updateTagSchema = z.object({ name: tagNameSchema })

export type TagInput = z.infer<typeof createTagSchema>

/** Comma-separated list of profile UUIDs (`?profileIds=a,b`). */
const profileIdsParamSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id !== ""),
  )
  .pipe(z.array(z.uuid({ message: "Neplatný profil" })).min(1))

/** Query params of `GET /api/time-entries`. Missing `from`/`to` = current week. */
export const listEntriesQuerySchema = z
  .object({
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
    direction: timeDirectionSchema.optional(),
    tagId: tagIdSchema.optional(),
    profileIds: profileIdsParamSchema.optional(),
  })
  .refine((value) => (value.from === undefined) === (value.to === undefined), {
    message: "Zadej začátek i konec období",
    path: ["to"],
  })
  .refine((value) => value.from === undefined || value.to === undefined || isValidTimeRange(value.from, value.to), {
    message: END_BEFORE_START_MESSAGE,
    path: ["to"],
  })

export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>

/** First issue message of a failed parse, for the `{ error }` response body. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? TIME_TRACKING_MESSAGES.invalidJson
}
