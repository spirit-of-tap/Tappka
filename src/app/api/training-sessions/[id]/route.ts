import { NextResponse } from "next/server"

import { isCapacityBelowGuests, sessionPatchSchema } from "@/lib/training-sessions/validation"

import {
  errorResponse,
  isApiFailure,
  mutationFailed,
  parseJson,
  requireOwnedSession,
  requireTsApiContext,
  rpcFailure,
} from "../_shared"

const HTTP_CONFLICT = 409

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const session = await requireOwnedSession(context, (await params).id)
  if (isApiFailure(session)) return session.response
  const patch = await parseJson(request, sessionPatchSchema)
  if (isApiFailure(patch)) return patch.response

  const audit = { updated_by_profile_id: context.profileId }

  if (patch.kind === "cancel" || patch.kind === "restore") {
    const cancelled = patch.kind === "cancel"
    const { error } = await context.supabase
      .from("training_sessions")
      .update({
        ...audit,
        cancelled_at: cancelled ? new Date().toISOString() : null,
        cancelled_by_profile_id: cancelled ? context.profileId : null,
      })
      .eq("id", session.id)
    if (error) return mutationFailed(error).response
    return NextResponse.json({ data: { id: session.id } })
  }

  const { count, error: countError } = await context.supabase
    .from("training_session_guests")
    .select("profile_id", { count: "exact", head: true })
    .eq("training_session_id", session.id)
  if (countError) return mutationFailed(countError).response
  const guestCount = count ?? 0
  if (isCapacityBelowGuests(patch.guestCapacity, guestCount)) {
    return errorResponse(
      `Obsazeno je už ${guestCount} míst, kapacitu nelze snížit pod tento počet`,
      HTTP_CONFLICT,
      "capacity_below_guests",
    ).response
  }

  const { error } = await context.supabase
    .from("training_sessions")
    .update({
      ...audit,
      topic: patch.topic,
      description: patch.description,
      starts_at: patch.startsAt,
      ends_at: patch.endsAt,
      room_id: patch.roomId,
      location_note: patch.locationNote,
      guest_capacity: patch.guestCapacity,
    })
    .eq("id", session.id)
  if (error) return mutationFailed(error).response

  const { error: deleteError } = await context.supabase
    .from("training_session_facilitators")
    .delete()
    .eq("training_session_id", session.id)
  if (deleteError) return mutationFailed(deleteError).response
  if (patch.facilitatorIds.length > 0) {
    const { error: insertError } = await context.supabase.from("training_session_facilitators").insert(
      patch.facilitatorIds.map((profileId) => ({
        training_session_id: session.id,
        profile_id: profileId,
        created_by_profile_id: context.profileId,
      })),
    )
    if (insertError) return mutationFailed(insertError).response
  }

  return NextResponse.json({ data: { id: session.id } })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const session = await requireOwnedSession(context, (await params).id)
  if (isApiFailure(session)) return session.response
  const { error } = await context.supabase.rpc("remove_training_session", { p_session_id: session.id })
  if (error) return rpcFailure(error).response
  return NextResponse.json({ data: { id: session.id } })
}
