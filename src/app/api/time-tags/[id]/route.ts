import { NextRequest, NextResponse } from "next/server"

import { serverLogger } from "@/lib/server-logger"
import { HTTP_STATUS } from "@/lib/time-tracking/api-errors"
import { TIME_TRACKING_MESSAGES } from "@/lib/time-tracking/constants"
import {
  dbErrorResponse,
  jsonError,
  readJsonBody,
  requireTimeTrackingContext,
  unexpectedErrorResponse,
} from "@/lib/time-tracking/route-auth"
import { firstIssueMessage, idParamSchema, updateTagSchema } from "@/lib/time-tracking/validation"

interface RouteParams {
  params: Promise<{ id: string }>
}

/** PATCH /api/time-tags/[id] — rename an own tag. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const { id } = await params
    if (!idParamSchema.safeParse(id).success) {
      return jsonError(TIME_TRACKING_MESSAGES.tagNotFound, HTTP_STATUS.notFound)
    }

    const body = await readJsonBody(request)
    if (body === undefined) {
      return jsonError(TIME_TRACKING_MESSAGES.invalidJson, HTTP_STATUS.badRequest)
    }
    const parsed = updateTagSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(firstIssueMessage(parsed.error), HTTP_STATUS.badRequest)
    }

    const { data, error } = await supabase
      .from("time_tags")
      .update({ name: parsed.data.name, updated_by_profile_id: profile.id })
      .eq("id", id)
      .eq("profile_id", profile.id)
      .select("*")
      .maybeSingle()

    if (error) {
      serverLogger.console.error("PATCH /api/time-tags/[id] update error:", error)
      return dbErrorResponse(error)
    }
    if (!data) {
      return jsonError(TIME_TRACKING_MESSAGES.tagNotFound, HTTP_STATUS.notFound)
    }

    return NextResponse.json({ data })
  } catch (error) {
    return unexpectedErrorResponse("PATCH /api/time-tags/[id]", error)
  }
}

/** DELETE /api/time-tags/[id] — delete an own tag; entries keep their time (`tag_id` set to null). */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const { id } = await params
    if (!idParamSchema.safeParse(id).success) {
      return jsonError(TIME_TRACKING_MESSAGES.tagNotFound, HTTP_STATUS.notFound)
    }

    const { data, error } = await supabase
      .from("time_tags")
      .delete()
      .eq("id", id)
      .eq("profile_id", profile.id)
      .select("id")
      .maybeSingle()

    if (error) {
      serverLogger.console.error("DELETE /api/time-tags/[id] error:", error)
      return dbErrorResponse(error)
    }
    if (!data) {
      return jsonError(TIME_TRACKING_MESSAGES.tagNotFound, HTTP_STATUS.notFound)
    }

    return NextResponse.json({ data: { id: data.id } })
  } catch (error) {
    return unexpectedErrorResponse("DELETE /api/time-tags/[id]", error)
  }
}
