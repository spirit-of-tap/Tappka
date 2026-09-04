import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUserProfile } from "@/lib/auth-helpers"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { deleteFile, generateFileKey, uploadFile } from "@/lib/storage/service"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"
import { TEAM_ACTIVITY_IMAGE } from "@/lib/tymovy-denik/image"
import { getWebpDimensions } from "@/lib/tymovy-denik/webp"
import { serverLogger } from "@/lib/server-logger";

const MAX_ACTIVITY_TYPE_LENGTH = 200
const MAX_PARTICIPANTS_LENGTH = 1_000
const MAX_STORY_FIELD_LENGTH = 10_000
const STORAGE_DELETE_ATTEMPTS = 3
const TEAM_ACTIVITY_IMAGE_PREFIX = "team-activities"

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null)

const attendeeInputSchema = z.object({
  profileId: z.string().uuid(),
  status: z.enum(["present", "absent", "excused", "late"]).default("present"),
})

const inputSchema = z.object({
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activityType: z.string().trim().min(1).max(MAX_ACTIVITY_TYPE_LENGTH),
  participants: nullableText(MAX_PARTICIPANTS_LENGTH),
  reason: nullableText(MAX_STORY_FIELD_LENGTH),
  reflection: nullableText(MAX_STORY_FIELD_LENGTH),
  attendees: z.array(attendeeInputSchema).optional().default([]),
  photoAction: z.enum(["keep", "remove", "replace"]),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
})

const expectedUpdatedAtSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
})

export interface TeamActivityAttendeeInput {
  profileId: string
  status: "present" | "absent" | "excused" | "late"
}

export interface TeamActivityInput {
  occurredAt: string
  activityType: string
  participants: string | null
  reason: string | null
  reflection: string | null
  attendees: TeamActivityAttendeeInput[]
  photoAction: "keep" | "remove" | "replace"
  expectedUpdatedAt?: string
}


interface TeamActivityApiContext {
  profileId: string
  teamId: string
  supabase: SupabaseClient<Database>
}

interface ApiFailure {
  response: NextResponse
}

interface ParsedTeamActivityRequest {
  input: TeamActivityInput
  photo: Buffer | null
}

export async function requireTeamActivityApiContext(): Promise<TeamActivityApiContext | ApiFailure> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { response: NextResponse.json({ error: "Neautorizováno" }, { status: 401 }) }
  }

  const profile = await getCurrentUserProfile(supabase, { user })
  if (!profile?.team_id) {
    return { response: NextResponse.json({ error: "K této funkci nemáte přístup" }, { status: 403 }) }
  }
  if (
    !canAccessFeature(
      {
        role: profile.role,
        beta_access_granted_at: profile.beta_access_granted_at,
        beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
      },
      "teamDiary",
    )
  ) {
    return { response: NextResponse.json({ error: "K této funkci nemáte přístup" }, { status: 403 }) }
  }

  return { profileId: profile.id, teamId: profile.team_id, supabase }
}

export function isApiFailure<T>(result: T | ApiFailure): result is ApiFailure {
  return typeof result === "object" && result !== null && "response" in result
}

export async function parseTeamActivityRequest(
  request: Request,
  requireExpectedUpdatedAt = false,
): Promise<ParsedTeamActivityRequest | ApiFailure> {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return invalidPayload()
  }

  const rawPayload = formData.get("payload")
  if (typeof rawPayload !== "string") return invalidPayload()

  let payload: unknown
  try {
    payload = JSON.parse(rawPayload)
  } catch {
    return invalidPayload()
  }

  const parsed = inputSchema.safeParse(payload)
  if (!parsed.success || (requireExpectedUpdatedAt && !parsed.data.expectedUpdatedAt)) {
    return invalidPayload()
  }

  const filePart = formData.get("photo")
  const photoFile = filePart instanceof File && filePart.size > 0 ? filePart : null
  if (parsed.data.photoAction === "replace" && !photoFile) {
    return { response: NextResponse.json({ error: "Vyberte fotografii" }, { status: 400 }) }
  }
  if (parsed.data.photoAction !== "replace" && photoFile) return invalidPayload()
  if (!photoFile) return { input: parsed.data, photo: null }

  if (photoFile.type !== "image/webp" || photoFile.size > TEAM_ACTIVITY_IMAGE.maxUploadBytes) {
    return {
      response: NextResponse.json(
        { error: "Optimalizovaná fotografie musí být WebP a mít nejvýše 3 MB" },
        { status: 400 },
      ),
    }
  }

  const photo = Buffer.from(await photoFile.arrayBuffer())
  const dimensions = await getWebpDimensions(photo)
  if (!dimensions) {
    return { response: NextResponse.json({ error: "Soubor není platná fotografie WebP" }, { status: 400 }) }
  }
  if (Math.max(dimensions.width, dimensions.height) > TEAM_ACTIVITY_IMAGE.maxEdge) {
    return {
      response: NextResponse.json(
        { error: `Fotografie může mít nejvýše ${TEAM_ACTIVITY_IMAGE.maxEdge} px na delší straně` },
        { status: 400 },
      ),
    }
  }

  return { input: parsed.data, photo }
}

export async function parseExpectedUpdatedAtRequest(
  request: Request,
): Promise<{ expectedUpdatedAt: string } | ApiFailure> {
  try {
    const parsed = expectedUpdatedAtSchema.safeParse(await request.json())
    return parsed.success ? parsed.data : invalidPayload()
  } catch {
    return invalidPayload()
  }
}

export async function storeTeamActivityPhoto(photo: Buffer, teamId: string): Promise<string> {
  const key = generateFileKey(TEAM_ACTIVITY_IMAGE_PREFIX, teamId, "webp")
  try {
    return await uploadFile("images", key, photo, "image/webp", {
      cacheControl: "31536000",
      upsert: false,
    })
  } catch (error) {
    // The object may exist when Storage accepted the upload but its response was lost.
    await deleteTeamActivityPhoto(key, teamId)
    throw error
  }
}

export async function deleteTeamActivityPhoto(path: string | null, teamId: string): Promise<void> {
  if (!path || !path.startsWith(`${TEAM_ACTIVITY_IMAGE_PREFIX}/${teamId}/`)) return
  for (let attempt = 1; attempt <= STORAGE_DELETE_ATTEMPTS; attempt += 1) {
    try {
      await deleteFile("images", path)
      return
    } catch (error) {
      if (attempt === STORAGE_DELETE_ATTEMPTS) {
        serverLogger.console.error("Failed to delete team activity photo after retries:", error)
      }
    }
  }
}

export function activityRow(input: TeamActivityInput) {
  return {
    occurred_at: input.occurredAt,
    activity_type: input.activityType,
    participants: input.participants,
    reason: input.reason,
    reflection: input.reflection,
  }
}

export function invalidIdResponse(): NextResponse {
  return NextResponse.json({ error: "Neplatný identifikátor" }, { status: 400 })
}

export function isValidId(id: string): boolean {
  return z.uuid().safeParse(id).success
}

export function isAmbiguousMutation(
  error: { code?: string } | null,
  status?: number,
): boolean {
  return status === 0 && error?.code === ""
}

export function mutationFailedResponse(error: unknown): NextResponse {
  serverLogger.console.error("Team activity mutation failed:", error)
  return NextResponse.json({ error: "Akci se nepodařilo uložit" }, { status: 500 })
}

function invalidPayload(): ApiFailure {
  return { response: NextResponse.json({ error: "Neplatná data požadavku" }, { status: 400 }) }
}
