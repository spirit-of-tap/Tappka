import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import {
  activityRow,
  deleteTeamActivityPhoto,
  isAmbiguousMutation,
  isApiFailure,
  mutationFailedResponse,
  parseTeamActivityRequest,
  requireTeamActivityApiContext,
  storeTeamActivityPhoto,
} from "./_shared"
import { ACTIVITY_WITH_CREATOR_SELECT } from "@/lib/tymovy-denik/types"

export async function POST(request: Request) {
  const context = await requireTeamActivityApiContext()
  if (isApiFailure(context)) return context.response

  const parsed = await parseTeamActivityRequest(request)
  if (isApiFailure(parsed)) return parsed.response

  const activityId = randomUUID()
  let newImagePath: string | null = null
  let mutationAttempted = false
  let mutationOutcomeAmbiguous = false
  try {
    if (parsed.photo) newImagePath = await storeTeamActivityPhoto(parsed.photo, context.teamId)

    mutationAttempted = true
    mutationOutcomeAmbiguous = true
    const { data, error, status } = await context.supabase
      .from("team_activities")
      .insert({
        ...activityRow(parsed.input),
        id: activityId,
        team_id: context.teamId,
        image_path: newImagePath,
        created_by_profile_id: context.profileId,
        updated_by_profile_id: context.profileId,
      })
      .select(ACTIVITY_WITH_CREATOR_SELECT)
      .single()

    mutationOutcomeAmbiguous = isAmbiguousMutation(error, status) || (!error && !data)
    if (error || !data) throw error ?? new Error("Team activity insert returned no row")

    if (parsed.input.attendees && parsed.input.attendees.length > 0) {
      const attendeeRows = parsed.input.attendees.map((a) => ({
        activity_id: activityId,
        profile_id: a.profileId,
        status: a.status,
        created_by_profile_id: context.profileId,
        updated_by_profile_id: context.profileId,
      }))
      const { error: attendeesError } = await context.supabase
        .from("team_activity_attendees")
        .insert(attendeeRows)

      if (attendeesError) {
        console.error("Failed to insert team activity attendees:", attendeesError)
      }
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    if (mutationAttempted) {
      if (!mutationOutcomeAmbiguous) {
        await deleteTeamActivityPhoto(newImagePath, context.teamId)
        return mutationFailedResponse(error)
      }

      const { data: committed, error: reconcileError } = await context.supabase
        .from("team_activities")
        .select(ACTIVITY_WITH_CREATOR_SELECT)
        .eq("id", activityId)
        .eq("team_id", context.teamId)
        .maybeSingle()

      if (!reconcileError && committed) {
        return NextResponse.json({ data: committed }, { status: 201 })
      }
    }
    return mutationFailedResponse(error)
  }
}

