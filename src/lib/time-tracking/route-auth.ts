import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

import { getCurrentUserProfile, type Profile } from "@/lib/auth-helpers"
import { canAccessFeature, type AccessProfile, type BetaCohort } from "@/lib/feature-access"
import type { Database } from "@/lib/supabase/database.types"
import { serverLogger } from "@/lib/server-logger"
import { createClient } from "@/lib/supabase/server"

import { HTTP_STATUS, isDbErrorLike, mapDbError, type DbErrorLike } from "./api-errors"
import { TIME_TRACKING_MESSAGES } from "./constants"

const DEFAULT_BETA_COHORT: BetaCohort = "A"

export interface TimeTrackingContext {
  supabase: SupabaseClient<Database>
  profile: Profile
}

export type TimeTrackingAuthResult =
  | { ok: true; context: TimeTrackingContext }
  | { ok: false; response: NextResponse }

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export function dbErrorResponse(error: DbErrorLike | null | undefined): NextResponse {
  const mapped = mapDbError(error)
  return jsonError(mapped.message, mapped.status)
}

/** Logs an unexpected (thrown) error and maps it to a JSON error response. */
export function unexpectedErrorResponse(label: string, error: unknown): NextResponse {
  serverLogger.console.error(`${label} error:`, error)
  return isDbErrorLike(error)
    ? dbErrorResponse(error)
    : jsonError(TIME_TRACKING_MESSAGES.generic, HTTP_STATUS.internalError)
}

function toAccessProfile(profile: Profile): AccessProfile {
  return {
    role: profile.role,
    beta_access_granted_at: profile.beta_access_granted_at,
    beta_cohort: profile.beta_cohort ?? DEFAULT_BETA_COHORT,
    teamId: profile.team_id,
  }
}

/**
 * Auth prelude shared by all time-tracking route handlers:
 * claims → profile (401/403) → `timeTracking` feature gate (403 „Modul není dostupný").
 */
export async function requireTimeTrackingContext(): Promise<TimeTrackingAuthResult> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null

  if (!user) {
    return { ok: false, response: jsonError(TIME_TRACKING_MESSAGES.unauthorized, HTTP_STATUS.unauthorized) }
  }

  const profile = await getCurrentUserProfile(supabase, { user })
  if (!profile) {
    return { ok: false, response: jsonError(TIME_TRACKING_MESSAGES.profileNotFound, HTTP_STATUS.forbidden) }
  }

  if (!canAccessFeature(toAccessProfile(profile), "timeTracking")) {
    return { ok: false, response: jsonError(TIME_TRACKING_MESSAGES.featureUnavailable, HTTP_STATUS.forbidden) }
  }

  return { ok: true, context: { supabase, profile } }
}

/** Parses a JSON body; returns `undefined` when the body is not valid JSON. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown
  } catch {
    return undefined
  }
}
