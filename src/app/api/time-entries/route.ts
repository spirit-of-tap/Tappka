import { NextRequest, NextResponse } from "next/server"

import { serverLogger } from "@/lib/server-logger"
import type { Insertable } from "@/lib/supabase/tables"
import { HTTP_STATUS } from "@/lib/time-tracking/api-errors"
import { TIME_ENTRY_WITH_TAG_SELECT, TIME_TRACKING_MESSAGES } from "@/lib/time-tracking/constants"
import { computeDurationMs } from "@/lib/time-tracking/duration"
import { isOwnTag, listEntries } from "@/lib/time-tracking/queries"
import {
  dbErrorResponse,
  jsonError,
  readJsonBody,
  requireTimeTrackingContext,
  unexpectedErrorResponse,
} from "@/lib/time-tracking/route-auth"
import { createEntrySchema, firstIssueMessage, listEntriesQuerySchema } from "@/lib/time-tracking/validation"
import { getWeekRange } from "@/lib/time-tracking/week"

const LIST_QUERY_KEYS = ["from", "to", "direction", "tagId", "profileIds"] as const

/**
 * GET /api/time-entries?from=&to=&direction=&tagId=&profileIds=a,b
 * Defaults: own profile, current Prague week. RLS limits visibility to self, teammates,
 * or everyone for coaches and admins.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const rawQuery: Record<string, string> = {}
    for (const key of LIST_QUERY_KEYS) {
      const value = request.nextUrl.searchParams.get(key)
      if (value !== null && value !== "") rawQuery[key] = value
    }

    const parsed = listEntriesQuerySchema.safeParse(rawQuery)
    if (!parsed.success) {
      return jsonError(firstIssueMessage(parsed.error), HTTP_STATUS.badRequest)
    }

    const week = getWeekRange(new Date())
    const entries = await listEntries(supabase, {
      profileIds: parsed.data.profileIds ?? [profile.id],
      from: parsed.data.from ?? week.from,
      to: parsed.data.to ?? week.to,
      direction: parsed.data.direction,
      tagId: parsed.data.tagId,
    })

    return NextResponse.json({ data: entries })
  } catch (error) {
    return unexpectedErrorResponse("GET /api/time-entries", error)
  }
}

/** POST /api/time-entries — manual entry for the session profile. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireTimeTrackingContext()
    if (!auth.ok) return auth.response
    const { supabase, profile } = auth.context

    const body = await readJsonBody(request)
    if (body === undefined) {
      return jsonError(TIME_TRACKING_MESSAGES.invalidJson, HTTP_STATUS.badRequest)
    }

    const parsed = createEntrySchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(firstIssueMessage(parsed.error), HTTP_STATUS.badRequest)
    }
    const input = parsed.data
    const tagId = input.tagId ?? null

    if (tagId !== null && !(await isOwnTag(supabase, profile.id, tagId))) {
      return jsonError(TIME_TRACKING_MESSAGES.invalidTag, HTTP_STATUS.badRequest)
    }

    const startedAt = new Date(input.startedAt).toISOString()
    const endedAt = new Date(input.endedAt).toISOString()

    const payload: Insertable<"time_entries"> = {
      profile_id: profile.id,
      direction: input.direction,
      tag_id: tagId,
      title: input.title ?? null,
      started_at: startedAt,
      ended_at: endedAt,
      duration_ms: computeDurationMs(startedAt, endedAt),
      source: "manual",
      created_by_profile_id: profile.id,
      updated_by_profile_id: profile.id,
    }

    const { data, error } = await supabase
      .from("time_entries")
      .insert(payload)
      .select(TIME_ENTRY_WITH_TAG_SELECT)
      .single()

    if (error) {
      serverLogger.console.error("POST /api/time-entries insert error:", error)
      return dbErrorResponse(error)
    }

    return NextResponse.json({ data }, { status: HTTP_STATUS.created })
  } catch (error) {
    return unexpectedErrorResponse("POST /api/time-entries", error)
  }
}
