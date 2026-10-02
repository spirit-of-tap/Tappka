import { NextResponse } from "next/server"

import { attendanceInputSchema } from "@/lib/training-sessions/validation"

import { isApiFailure, mutationFailed, parseJson, requireOwnedSession, requireTsApiContext } from "../../_shared"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const session = await requireOwnedSession(context, (await params).id)
  if (isApiFailure(session)) return session.response
  const input = await parseJson(request, attendanceInputSchema)
  if (isApiFailure(input)) return input.response

  const recorded = input.attendees.filter((attendee) => attendee.status !== "absent")
  const keepIds = recorded.map((attendee) => attendee.profileId)

  let deleteQuery = context.supabase.from("training_session_attendees").delete().eq("training_session_id", session.id)
  if (keepIds.length > 0) deleteQuery = deleteQuery.not("profile_id", "in", `(${keepIds.join(",")})`)
  const { error: deleteError } = await deleteQuery
  if (deleteError) return mutationFailed(deleteError).response

  if (recorded.length > 0) {
    const { error } = await context.supabase.from("training_session_attendees").upsert(
      recorded.map((attendee) => ({
        training_session_id: session.id,
        profile_id: attendee.profileId,
        status: attendee.status,
        created_by_profile_id: context.profileId,
        updated_by_profile_id: context.profileId,
      })),
      { onConflict: "training_session_id,profile_id" },
    )
    if (error) return mutationFailed(error).response
  }
  return NextResponse.json({ data: { ok: true } })
}
