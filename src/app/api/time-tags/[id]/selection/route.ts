import { NextRequest, NextResponse } from "next/server"

import { HTTP_STATUS } from "@/lib/time-tracking/api-errors"
import { TIME_TRACKING_MESSAGES } from "@/lib/time-tracking/constants"
import { setTagSelected } from "@/lib/time-tracking/queries"
import {
  jsonError,
  readJsonBody,
  requireTimeTrackingContext,
  unexpectedErrorResponse,
} from "@/lib/time-tracking/route-auth"
import { firstIssueMessage, idParamSchema, tagSelectionSchema } from "@/lib/time-tracking/validation"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PUT /api/time-tags/[id]/selection — `{ selected }` shows or hides a team tag in the
 * session profile's tag picker. System tags are always shown and cannot be toggled.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const { id } = await params
    if (!idParamSchema.safeParse(id).success || profile.team_id === null) {
      return jsonError(TIME_TRACKING_MESSAGES.tagNotFound, HTTP_STATUS.notFound)
    }

    const body = await readJsonBody(request)
    if (body === undefined) {
      return jsonError(TIME_TRACKING_MESSAGES.invalidJson, HTTP_STATUS.badRequest)
    }
    const parsed = tagSelectionSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(firstIssueMessage(parsed.error), HTTP_STATUS.badRequest)
    }

    // Only the own team's tags can be toggled (system tags are always shown).
    const { data: tag, error } = await supabase.from("time_tags").select("team_id").eq("id", id).maybeSingle()
    if (error) throw error
    if (tag === null || tag.team_id !== profile.team_id) {
      return jsonError(TIME_TRACKING_MESSAGES.tagNotFound, HTTP_STATUS.notFound)
    }

    await setTagSelected(supabase, profile.id, id, parsed.data.selected)
    return NextResponse.json({ data: { tagId: id, selected: parsed.data.selected } })
  } catch (error) {
    return unexpectedErrorResponse("PUT /api/time-tags/[id]/selection", error)
  }
}
