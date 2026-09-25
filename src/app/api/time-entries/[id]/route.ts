import { NextRequest, NextResponse } from "next/server"

import { serverLogger } from "@/lib/server-logger"
import type { Updatable } from "@/lib/supabase/tables"
import { HTTP_STATUS } from "@/lib/time-tracking/api-errors"
import { TIME_ENTRY_WITH_TAG_SELECT, TIME_TRACKING_MESSAGES } from "@/lib/time-tracking/constants"
import { computeDurationMs } from "@/lib/time-tracking/duration"
import { getEntry, isOwnTag } from "@/lib/time-tracking/queries"
import {
  dbErrorResponse,
  jsonError,
  readJsonBody,
  requireTimeTrackingContext,
  unexpectedErrorResponse,
} from "@/lib/time-tracking/route-auth"
import {
  firstIssueMessage,
  idParamSchema,
  isValidTimeRange,
  updateEntrySchema,
} from "@/lib/time-tracking/validation"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/time-entries/[id] — partial update of an own entry.
 * `duration_ms` is recomputed server-side whenever start or end changes.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const { id } = await params
    if (!idParamSchema.safeParse(id).success) {
      return jsonError(TIME_TRACKING_MESSAGES.entryNotFound, HTTP_STATUS.notFound)
    }

    const body = await readJsonBody(request)
    if (body === undefined) {
      return jsonError(TIME_TRACKING_MESSAGES.invalidJson, HTTP_STATUS.badRequest)
    }
    const parsed = updateEntrySchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(firstIssueMessage(parsed.error), HTTP_STATUS.badRequest)
    }
    const input = parsed.data

    const existing = await getEntry(supabase, id)
    if (!existing || existing.profile_id !== profile.id) {
      return jsonError(TIME_TRACKING_MESSAGES.entryNotFound, HTTP_STATUS.notFound)
    }

    if (input.tagId !== undefined && input.tagId !== null && !(await isOwnTag(supabase, profile.id, input.tagId))) {
      return jsonError(TIME_TRACKING_MESSAGES.invalidTag, HTTP_STATUS.badRequest)
    }

    const startedAt = input.startedAt === undefined ? existing.started_at : new Date(input.startedAt).toISOString()
    const endedAt = input.endedAt === undefined ? existing.ended_at : new Date(input.endedAt).toISOString()
    if (endedAt !== null && !isValidTimeRange(startedAt, endedAt)) {
      return jsonError(TIME_TRACKING_MESSAGES.invalidRange, HTTP_STATUS.badRequest)
    }

    const update: Updatable<"time_entries"> = { updated_by_profile_id: profile.id }
    if (input.direction !== undefined) update.direction = input.direction
    if (input.tagId !== undefined) update.tag_id = input.tagId
    if (input.title !== undefined) update.title = input.title
    if (input.startedAt !== undefined || input.endedAt !== undefined) {
      update.started_at = startedAt
      update.ended_at = endedAt
      update.duration_ms = endedAt === null ? null : computeDurationMs(startedAt, endedAt)
    }

    const { data, error } = await supabase
      .from("time_entries")
      .update(update)
      .eq("id", id)
      .eq("profile_id", profile.id)
      .select(TIME_ENTRY_WITH_TAG_SELECT)
      .maybeSingle()

    if (error) {
      serverLogger.console.error("PATCH /api/time-entries/[id] update error:", error)
      return dbErrorResponse(error)
    }
    if (!data) {
      return jsonError(TIME_TRACKING_MESSAGES.entryNotFound, HTTP_STATUS.notFound)
    }

    return NextResponse.json({ data })
  } catch (error) {
    return unexpectedErrorResponse("PATCH /api/time-entries/[id]", error)
  }
}

/** DELETE /api/time-entries/[id] — hard delete of an own entry (including a running timer). */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const { id } = await params
    if (!idParamSchema.safeParse(id).success) {
      return jsonError(TIME_TRACKING_MESSAGES.entryNotFound, HTTP_STATUS.notFound)
    }

    const { data, error } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", id)
      .eq("profile_id", profile.id)
      .select("id")
      .maybeSingle()

    if (error) {
      serverLogger.console.error("DELETE /api/time-entries/[id] error:", error)
      return dbErrorResponse(error)
    }
    if (!data) {
      return jsonError(TIME_TRACKING_MESSAGES.entryNotFound, HTTP_STATUS.notFound)
    }

    return NextResponse.json({ data: { id: data.id } })
  } catch (error) {
    return unexpectedErrorResponse("DELETE /api/time-entries/[id]", error)
  }
}
