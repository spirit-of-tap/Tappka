import { after, NextResponse } from "next/server"
import { z } from "zod"

import { CALENDAR_ERRORS, canRobotWrite, describeCalendarError, isValidCalendarId } from "@/lib/training-sessions/calendar-sync-events"
import { createSyncDeps, syncTeamCalendar } from "@/lib/training-sessions/calendar-sync"
import { serverLogger } from "@/lib/server-logger"

import { errorResponse, isApiFailure, mutationFailed } from "../_shared"

import { requireCalendarManager, teamBodySchema } from "./_shared"

const HTTP_BAD_REQUEST = 400
const HTTP_SERVICE_UNAVAILABLE = 503
const NOT_CONFIGURED = "Synchronizace s Google Kalendářem zatím není na Tappce nastavená"

const connectSchema = teamBodySchema.extend({
  calendarId: z
    .string()
    .trim()
    .refine(isValidCalendarId, { message: "Tohle nevypadá jako ID kalendáře. Najdeš ho v nastavení kalendáře v části Integrace kalendáře." }),
})

/** Connect a team calendar: verifies the robot can change events, saves it, syncs upcoming TS. */
export async function POST(request: Request) {
  const guard = await requireCalendarManager(request, connectSchema)
  if (isApiFailure(guard)) return guard.response
  const { context, input } = guard

  const deps = createSyncDeps()
  if (!deps) return errorResponse(NOT_CONFIGURED, HTTP_SERVICE_UNAVAILABLE).response

  let calendarName: string
  try {
    const access = await deps.google.getAccess(input.calendarId)
    if (!canRobotWrite(access.accessRole)) return errorResponse(CALENDAR_ERRORS.readOnly, HTTP_BAD_REQUEST).response
    calendarName = access.name
  } catch (error) {
    return errorResponse(describeCalendarError(error), HTTP_BAD_REQUEST).response
  }

  const { error } = await context.supabase.from("team_google_calendars").upsert({
    team_id: input.teamId,
    calendar_id: input.calendarId,
    calendar_name: calendarName,
    connected_by_profile_id: context.profileId,
    connected_at: new Date().toISOString(),
    last_synced_at: null,
  })
  if (error) return mutationFailed(error).response

  after(async () => {
    try {
      await syncTeamCalendar(deps, input.teamId, "upcoming")
    } catch (syncError) {
      serverLogger.console.error("Initial team calendar sync crashed:", syncError)
    }
  })
  return NextResponse.json({ data: { calendarName } })
}

/** Disconnect: stops syncing. Events already in the calendar stay there. */
export async function DELETE(request: Request) {
  const guard = await requireCalendarManager(request, teamBodySchema)
  if (isApiFailure(guard)) return guard.response
  const { context, input } = guard

  const { error } = await context.supabase.from("team_google_calendars").delete().eq("team_id", input.teamId)
  if (error) return mutationFailed(error).response

  // Sync state belongs to the old connection; a new one starts clean. Service role: users can't write it.
  const deps = createSyncDeps()
  if (deps) await deps.admin.from("training_session_calendar_events").delete().eq("team_id", input.teamId)
  return NextResponse.json({ data: { teamId: input.teamId } })
}
