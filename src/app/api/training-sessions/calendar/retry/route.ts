import { NextResponse } from "next/server"

import { createSyncDeps, syncTeamCalendar } from "@/lib/training-sessions/calendar-sync"

import { errorResponse, isApiFailure } from "../../_shared"

import { requireCalendarManager, teamBodySchema } from "../_shared"

const HTTP_SERVICE_UNAVAILABLE = 503

/** Retries every session whose last sync failed; waits so the page can show the result. */
export async function POST(request: Request) {
  const guard = await requireCalendarManager(request, teamBodySchema)
  if (isApiFailure(guard)) return guard.response

  const deps = createSyncDeps()
  if (!deps) return errorResponse("Synchronizace s Google Kalendářem zatím není na Tappce nastavená", HTTP_SERVICE_UNAVAILABLE).response

  const result = await syncTeamCalendar(deps, guard.input.teamId, "failed")
  return NextResponse.json({ data: result })
}
