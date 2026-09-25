import { NextRequest, NextResponse } from "next/server"

import { serverLogger } from "@/lib/server-logger"
import type { Insertable } from "@/lib/supabase/tables"
import { HTTP_STATUS } from "@/lib/time-tracking/api-errors"
import { TIME_ENTRY_WITH_TAG_SELECT, TIME_TRACKING_MESSAGES } from "@/lib/time-tracking/constants"
import { getActiveTimer, isOwnTag, stopActiveTimer } from "@/lib/time-tracking/queries"
import {
  dbErrorResponse,
  jsonError,
  readJsonBody,
  requireTimeTrackingContext,
  unexpectedErrorResponse,
} from "@/lib/time-tracking/route-auth"
import { firstIssueMessage, timerActionSchema } from "@/lib/time-tracking/validation"

/** GET /api/time-entries/timer — the session profile's running timer, or `null`. */
export async function GET() {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const active = await getActiveTimer(supabase, profile.id)
    return NextResponse.json({ data: active })
  } catch (error) {
    return unexpectedErrorResponse("GET /api/time-entries/timer", error)
  }
}

/**
 * POST /api/time-entries/timer
 * - `{ action: "start", direction, tagId?, title? }` stops any running timer, then starts a new one.
 * - `{ action: "stop" }` stops the running timer (always saved, no minimum length).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const body = await readJsonBody(request)
    if (body === undefined) {
      return jsonError(TIME_TRACKING_MESSAGES.invalidJson, HTTP_STATUS.badRequest)
    }
    const parsed = timerActionSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(firstIssueMessage(parsed.error), HTTP_STATUS.badRequest)
    }
    const input = parsed.data

    if (input.action === "stop") {
      const stopped = await stopActiveTimer(supabase, profile.id, new Date())
      return NextResponse.json({ data: stopped })
    }

    const tagId = input.tagId ?? null
    if (tagId !== null && !(await isOwnTag(supabase, profile.id, tagId))) {
      return jsonError(TIME_TRACKING_MESSAGES.invalidTag, HTTP_STATUS.badRequest)
    }

    const stopped = await stopActiveTimer(supabase, profile.id, new Date())

    const payload: Insertable<"time_entries"> = {
      profile_id: profile.id,
      direction: input.direction,
      tag_id: tagId,
      title: input.title ?? null,
      started_at: new Date().toISOString(),
      ended_at: null,
      duration_ms: null,
      source: "timer",
      created_by_profile_id: profile.id,
      updated_by_profile_id: profile.id,
    }

    const { data, error } = await supabase
      .from("time_entries")
      .insert(payload)
      .select(TIME_ENTRY_WITH_TAG_SELECT)
      .single()

    if (error) {
      serverLogger.console.error("POST /api/time-entries/timer start error:", error)
      return dbErrorResponse(error)
    }

    return NextResponse.json({ data, stopped }, { status: HTTP_STATUS.created })
  } catch (error) {
    return unexpectedErrorResponse("POST /api/time-entries/timer", error)
  }
}
