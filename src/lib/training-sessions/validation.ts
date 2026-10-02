import { z } from "zod"

import { TS_LIMITS } from "./constants"

const ATTENDANCE_STATUSES = ["present", "absent", "excused", "late"] as const
const PREPARATION_ACTIONS = ["draft", "publish", "unpublish"] as const

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null))

const sessionFields = z.object({
  topic: z.string().trim().min(1).max(TS_LIMITS.topicMax),
  description: nullableText(TS_LIMITS.descriptionMax),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  roomId: z.uuid().nullable(),
  locationNote: nullableText(TS_LIMITS.locationNoteMax),
  guestCapacity: z.number().int().min(0).max(TS_LIMITS.guestCapacityMax),
  facilitatorIds: z.array(z.uuid()).max(TS_LIMITS.facilitatorsMax),
})

function hasValidDuration(value: { startsAt: string; endsAt: string }): boolean {
  const duration = new Date(value.endsAt).getTime() - new Date(value.startsAt).getTime()
  return duration > 0 && duration <= TS_LIMITS.maxDurationMs
}

const DURATION_ERROR = {
  message: "Konec musí být po začátku a TS může trvat nejvýše 12 hodin",
  path: ["endsAt"],
}

export const sessionInputSchema = sessionFields.refine(hasValidDuration, DURATION_ERROR)
export type SessionInput = z.infer<typeof sessionInputSchema>

export const sessionPatchSchema = z
  .discriminatedUnion("kind", [
    sessionFields.extend({ kind: z.literal("update") }),
    z.object({ kind: z.literal("cancel") }),
    z.object({ kind: z.literal("restore") }),
  ])
  .refine((value) => value.kind !== "update" || hasValidDuration(value), DURATION_ERROR)
export type SessionPatch = z.infer<typeof sessionPatchSchema>

const contentJsonSchema = z.record(z.string(), z.unknown())

export const preparationInputSchema = z.object({
  contentJson: contentJsonSchema,
  action: z.enum(PREPARATION_ACTIONS),
})

export const reflectionInputSchema = z.object({ contentJson: contentJsonSchema })

export const attendanceInputSchema = z.object({
  attendees: z
    .array(z.object({ profileId: z.uuid(), status: z.enum(ATTENDANCE_STATUSES) }))
    .max(TS_LIMITS.attendeesMax),
})

export function isCapacityBelowGuests(newCapacity: number, guestCount: number): boolean {
  return newCapacity < guestCount
}
