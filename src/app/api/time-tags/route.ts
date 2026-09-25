import { NextRequest, NextResponse } from "next/server"

import { serverLogger } from "@/lib/server-logger"
import type { Insertable } from "@/lib/supabase/tables"
import { HTTP_STATUS } from "@/lib/time-tracking/api-errors"
import { TIME_TRACKING_MESSAGES } from "@/lib/time-tracking/constants"
import { listTags } from "@/lib/time-tracking/queries"
import {
  dbErrorResponse,
  jsonError,
  readJsonBody,
  requireTimeTrackingContext,
  unexpectedErrorResponse,
} from "@/lib/time-tracking/route-auth"
import { createTagSchema, firstIssueMessage } from "@/lib/time-tracking/validation"

/** GET /api/time-tags — the session profile's tags, ordered by name. */
export async function GET() {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const tags = await listTags(supabase, profile.id)
    return NextResponse.json({ data: tags })
  } catch (error) {
    return unexpectedErrorResponse("GET /api/time-tags", error)
  }
}

/** POST /api/time-tags — `{ name }`, trimmed, 1–40 chars, unique per profile (case-insensitive). */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const body = await readJsonBody(request)
    if (body === undefined) {
      return jsonError(TIME_TRACKING_MESSAGES.invalidJson, HTTP_STATUS.badRequest)
    }
    const parsed = createTagSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(firstIssueMessage(parsed.error), HTTP_STATUS.badRequest)
    }

    const payload: Insertable<"time_tags"> = {
      profile_id: profile.id,
      name: parsed.data.name,
      created_by_profile_id: profile.id,
      updated_by_profile_id: profile.id,
    }

    const { data, error } = await supabase.from("time_tags").insert(payload).select("*").single()

    if (error) {
      serverLogger.console.error("POST /api/time-tags insert error:", error)
      return dbErrorResponse(error)
    }

    return NextResponse.json({ data }, { status: HTTP_STATUS.created })
  } catch (error) {
    return unexpectedErrorResponse("POST /api/time-tags", error)
  }
}
