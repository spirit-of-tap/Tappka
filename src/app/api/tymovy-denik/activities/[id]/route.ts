import { NextResponse } from "next/server"

import {
  activityRow,
  deleteTeamActivityPhoto,
  invalidIdResponse,
  isAmbiguousMutation,
  isApiFailure,
  isValidId,
  mutationFailedResponse,
  parseExpectedUpdatedAtRequest,
  parseTeamActivityRequest,
  requireTeamActivityApiContext,
  storeTeamActivityPhoto,
  type TeamActivityInput,
} from "../_shared"
import {
  ACTIVITY_WITH_CREATOR_SELECT,
  type TeamActivityWithCreator,
} from "@/lib/tymovy-denik/types"
import { serverLogger } from "@/lib/server-logger";

interface TeamActivityRouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, routeContext: TeamActivityRouteContext) {
  const { id } = await routeContext.params
  if (!isValidId(id)) return invalidIdResponse()

  const context = await requireTeamActivityApiContext()
  if (isApiFailure(context)) return context.response

  const parsed = await parseTeamActivityRequest(request, true)
  if (isApiFailure(parsed)) return parsed.response

  const { data: existing, error: readError } = await context.supabase
    .from("team_activities")
    .select("id, image_path, updated_at")
    .eq("id", id)
    .eq("team_id", context.teamId)
    .is("removed_at", null)
    .maybeSingle()

  if (readError) return mutationFailedResponse(readError)
  if (!existing) return NextResponse.json({ error: "Akce nebyla nalezena" }, { status: 404 })
  if (existing.updated_at !== parsed.input.expectedUpdatedAt) {
    return NextResponse.json(
      { error: "Akci mezitím upravil někdo další. Obnovte stránku a zkuste to znovu." },
      { status: 409 },
    )
  }

  let newImagePath: string | null = null
  let mutationAttempted = false
  let mutationOutcomeAmbiguous = false
  try {
    if (parsed.photo) newImagePath = await storeTeamActivityPhoto(parsed.photo, context.teamId)

    const imagePath = parsed.input.photoAction === "replace"
      ? newImagePath
      : parsed.input.photoAction === "remove"
        ? null
        : existing.image_path

    mutationAttempted = true
    mutationOutcomeAmbiguous = true
    const { data, error, status } = await context.supabase
      .from("team_activities")
      .update({
        ...activityRow(parsed.input),
        image_path: imagePath,
        updated_by_profile_id: context.profileId,
      })
      .eq("id", id)
      .eq("team_id", context.teamId)
      .eq("updated_at", parsed.input.expectedUpdatedAt!)
      .is("removed_at", null)
      .select(ACTIVITY_WITH_CREATOR_SELECT)
      .maybeSingle()

    mutationOutcomeAmbiguous = isAmbiguousMutation(error, status)
    if (error) throw error
    if (!data) {
      await deleteTeamActivityPhoto(newImagePath, context.teamId)
      return NextResponse.json(
        { error: "Akci mezitím upravil někdo další. Obnovte stránku a zkuste to znovu." },
        { status: 409 },
      )
    }

    if (parsed.input.attendees && parsed.input.attendees.length > 0) {
      await context.supabase
        .from("team_activity_attendees")
        .delete()
        .eq("activity_id", id)

      const attendeeRows = parsed.input.attendees.map((a) => ({
        activity_id: id,
        profile_id: a.profileId,
        status: a.status,
        created_by_profile_id: context.profileId,
        updated_by_profile_id: context.profileId,
      }))
      const { error: attendeesError } = await context.supabase
        .from("team_activity_attendees")
        .insert(attendeeRows)

      if (attendeesError) {
        serverLogger.console.error("Failed to insert team activity attendees on update:", attendeesError)
      }
    }

    if (existing.image_path !== data.image_path) {
      await deleteTeamActivityPhoto(existing.image_path, context.teamId)
    }
    return NextResponse.json({ data })

  } catch (error) {
    if (!mutationAttempted) return mutationFailedResponse(error)
    if (!mutationOutcomeAmbiguous) {
      await deleteTeamActivityPhoto(newImagePath, context.teamId)
      return mutationFailedResponse(error)
    }

    const { data: committed, error: reconcileError } = await context.supabase
      .from("team_activities")
      .select(ACTIVITY_WITH_CREATOR_SELECT)
      .eq("id", id)
      .eq("team_id", context.teamId)
      .is("removed_at", null)
      .maybeSingle()

    if (!reconcileError && committed && newImagePath && newImagePath === committed.image_path) {
      if (existing.image_path !== committed.image_path) {
        await deleteTeamActivityPhoto(existing.image_path, context.teamId)
      }
      return NextResponse.json({ data: committed })
    }

    if (
      !reconcileError
      && committed
      && isCommittedUpdate(
        committed as TeamActivityWithCreator,
        parsed.input,
        parsed.input.photoAction === "replace"
          ? newImagePath
          : parsed.input.photoAction === "remove"
            ? null
            : existing.image_path,
        existing.updated_at,
        context.profileId,
      )
    ) {
      if (existing.image_path !== committed.image_path) {
        await deleteTeamActivityPhoto(existing.image_path, context.teamId)
      }
      return NextResponse.json({ data: committed })
    }

    return mutationFailedResponse(error)
  }
}

export async function DELETE(request: Request, routeContext: TeamActivityRouteContext) {
  const { id } = await routeContext.params
  if (!isValidId(id)) return invalidIdResponse()

  const context = await requireTeamActivityApiContext()
  if (isApiFailure(context)) return context.response

  const parsed = await parseExpectedUpdatedAtRequest(request)
  if (isApiFailure(parsed)) return parsed.response

  const { data: existing, error: readError } = await context.supabase
    .from("team_activities")
    .select("id, image_path, updated_at")
    .eq("id", id)
    .eq("team_id", context.teamId)
    .is("removed_at", null)
    .maybeSingle()

  if (readError) return mutationFailedResponse(readError)
  if (!existing) return NextResponse.json({ error: "Akce nebyla nalezena" }, { status: 404 })
  if (existing.updated_at !== parsed.expectedUpdatedAt) {
    return NextResponse.json(
      { error: "Akci mezitím upravil někdo další. Obnovte stránku a zkuste to znovu." },
      { status: 409 },
    )
  }

  const { data, error } = await context.supabase
    .from("team_activities")
    .update({
      image_path: null,
      removed_at: new Date().toISOString(),
      updated_by_profile_id: context.profileId,
    })
    .eq("id", id)
    .eq("team_id", context.teamId)
    .eq("updated_at", parsed.expectedUpdatedAt)
    .is("removed_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    const { data: committed, error: reconcileError } = await context.supabase
      .from("team_activities")
      .select("id, image_path, removed_at")
      .eq("id", id)
      .eq("team_id", context.teamId)
      .maybeSingle()

    if (!reconcileError && committed?.removed_at && !committed.image_path) {
      await deleteTeamActivityPhoto(existing.image_path, context.teamId)
      return NextResponse.json({ success: true })
    }
    return mutationFailedResponse(error)
  }
  if (!data) {
    return NextResponse.json(
      { error: "Akci mezitím upravil někdo další. Obnovte stránku a zkuste to znovu." },
      { status: 409 },
    )
  }

  await deleteTeamActivityPhoto(existing.image_path, context.teamId)
  return NextResponse.json({ success: true })
}

function isCommittedUpdate(
  activity: TeamActivityWithCreator,
  input: TeamActivityInput,
  imagePath: string | null,
  previousUpdatedAt: string,
  profileId: string,
): boolean {
  return activity.updated_at !== previousUpdatedAt
    && activity.occurred_at === input.occurredAt
    && activity.activity_type === input.activityType
    && activity.participants === input.participants
    && activity.reason === input.reason
    && activity.reflection === input.reflection
    && activity.image_path === imagePath
    && activity.updated_by_profile_id === profileId
}
