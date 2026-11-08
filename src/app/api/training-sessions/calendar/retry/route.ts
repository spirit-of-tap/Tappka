import { NextResponse } from "next/server"

import { createSyncDeps, syncTeamCalendar } from "@/lib/training-sessions/calendar-sync"

import { errorResponse, isApiFailure } from "../../_shared"

import { requireCalendarManager, teamBodySchema } from "../_shared"

const HTTP_SERVICE_UNAVAILABLE = 503

/**
 * "Synchronizovat teď": pushes every upcoming TS, then retries whatever still failed
 * (e.g. a cancelled TS whose delete failed). Waits so the page can show the result.
 */
export async function POST(request: Request) {
  const guard = await requireCalendarManager(request, teamBodySchema)
  if (isApiFailure(guard)) return guard.response

  const deps = createSyncDeps()
  if (!deps) return errorResponse("Synchronizace s Google Kalendářem zatím není na Tappce nastavená", HTTP_SERVICE_UNAVAILABLE).response

  const upcoming = await syncTeamCalendar(deps, guard.input.teamId, "upcoming")
  const retried = await syncTeamCalendar(deps, guard.input.teamId, "failed")
  // Retried sessions were already counted as failed in the upcoming pass when they were upcoming.
  return NextResponse.json({ data: { synced: upcoming.synced + retried.synced, failed: retried.failed } })
}
