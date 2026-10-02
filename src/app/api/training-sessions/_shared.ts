import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUserProfile } from "@/lib/auth-helpers"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"
import { serverLogger } from "@/lib/server-logger"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { mapTsRpcError } from "@/lib/training-sessions/rpc-errors"

const HTTP_BAD_REQUEST = 400
const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const HTTP_NOT_FOUND = 404
const HTTP_SERVER_ERROR = 500

export interface TsApiContext {
  profileId: string
  teamId: string | null
  supabase: SupabaseClient<Database>
}

export interface ApiFailure {
  response: NextResponse
}

export function isApiFailure<T>(value: T | ApiFailure): value is ApiFailure {
  return typeof value === "object" && value !== null && "response" in value
}

export function errorResponse(error: string, status: number, code?: string): ApiFailure {
  return { response: NextResponse.json(code ? { error, code } : { error }, { status }) }
}

export async function requireTsApiContext(): Promise<TsApiContext | ApiFailure> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null
  if (!user) return errorResponse("Neautorizováno", HTTP_UNAUTHORIZED)

  const profile = await getCurrentUserProfile(supabase, { user })
  if (!profile) return errorResponse("K této funkci nemáš přístup", HTTP_FORBIDDEN)
  const allowed = canAccessFeature(
    {
      role: profile.role,
      beta_access_granted_at: profile.beta_access_granted_at,
      beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
    },
    "trainingSessions",
  )
  if (!allowed) return errorResponse("K této funkci nemáš přístup", HTTP_FORBIDDEN)
  return { profileId: profile.id, teamId: profile.team_id, supabase }
}

export function mutationFailed(error: unknown): ApiFailure {
  serverLogger.console.error("Training session mutation failed:", error)
  return errorResponse("Akci se nepodařilo uložit", HTTP_SERVER_ERROR)
}

/** Maps an RPC error to a typed response, falling back to a generic 500. */
export function rpcFailure(error: { message?: string }): ApiFailure {
  const mapped = mapTsRpcError(error.message)
  if (!mapped) return mutationFailed(error)
  return errorResponse(mapped.error, mapped.status, mapped.code)
}

export function invalidIdFailure(): ApiFailure {
  return errorResponse("Neplatný identifikátor", HTTP_BAD_REQUEST)
}

export function isValidId(id: string): boolean {
  return z.uuid().safeParse(id).success
}

/** Loads a session and asserts the caller belongs to its team. */
export async function requireOwnedSession(
  context: TsApiContext,
  id: string,
): Promise<{ id: string; team_id: string; starts_at: string; guest_capacity: number } | ApiFailure> {
  if (!isValidId(id)) return invalidIdFailure()
  const { data, error } = await context.supabase
    .from("training_sessions")
    .select("id, team_id, starts_at, guest_capacity")
    .eq("id", id)
    .maybeSingle()
  if (error) return mutationFailed(error)
  if (!data) return errorResponse("TS nebylo nalezeno", HTTP_NOT_FOUND)
  if (!context.teamId || data.team_id !== context.teamId) return errorResponse("TS patří jinému týmu", HTTP_FORBIDDEN)
  return data
}

export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T | ApiFailure> {
  try {
    const parsed = schema.safeParse(await request.json())
    if (parsed.success) return parsed.data
    return errorResponse(parsed.error.issues[0]?.message ?? "Neplatná data požadavku", HTTP_BAD_REQUEST)
  } catch {
    return errorResponse("Neplatná data požadavku", HTTP_BAD_REQUEST)
  }
}
