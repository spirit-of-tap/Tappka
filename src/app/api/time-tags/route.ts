import { NextRequest, NextResponse } from "next/server"

import { serverLogger } from "@/lib/server-logger"
import type { Insertable } from "@/lib/supabase/tables"
import { HTTP_STATUS } from "@/lib/time-tracking/api-errors"
import { TIME_TRACKING_MESSAGES } from "@/lib/time-tracking/constants"
import { getTagCatalog, setTagSelected } from "@/lib/time-tracking/queries"
import {
  dbErrorResponse,
  jsonError,
  readJsonBody,
  requireTimeTrackingContext,
  unexpectedErrorResponse,
} from "@/lib/time-tracking/route-auth"
import type { TagCatalog } from "@/lib/time-tracking/types"
import { createTagSchema, firstIssueMessage } from "@/lib/time-tracking/validation"

/**
 * GET /api/time-tags — `TagCatalog`: system tags and the team's tags (by name), the team
 * tags the session profile shows and how many new team tags await review.
 */
export async function GET() {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const { tags, selectedTagIds, newTagCount } = await getTagCatalog(supabase, profile)
    const data: TagCatalog = { tags, selectedTagIds, newTagCount }
    return NextResponse.json({ data })
  } catch (error) {
    return unexpectedErrorResponse("GET /api/time-tags", error)
  }
}

/**
 * POST /api/time-tags — `{ name, direction }` creates a team tag (Practise / Projekt only);
 * name trimmed, 1–40 chars, unique per team and direction (case-insensitive). The direction
 * is fixed for the tag's lifetime. The creator sees the new tag right away.
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
    const parsed = createTagSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(firstIssueMessage(parsed.error), HTTP_STATUS.badRequest)
    }

    if (profile.team_id === null) {
      return jsonError(TIME_TRACKING_MESSAGES.tagNeedsTeam, HTTP_STATUS.forbidden)
    }

    const payload: Insertable<"time_tags"> = {
      team_id: profile.team_id,
      direction: parsed.data.direction,
      name: parsed.data.name,
      created_by_profile_id: profile.id,
      updated_by_profile_id: profile.id,
    }

    const { data, error } = await supabase.from("time_tags").insert(payload).select("*").single()

    if (error) {
      serverLogger.console.error("POST /api/time-tags insert error:", error)
      return dbErrorResponse(error)
    }

    await setTagSelected(supabase, profile.id, data.id, true)
    return NextResponse.json({ data }, { status: HTTP_STATUS.created })
  } catch (error) {
    return unexpectedErrorResponse("POST /api/time-tags", error)
  }
}
