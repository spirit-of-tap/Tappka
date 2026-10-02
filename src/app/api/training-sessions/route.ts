import { NextResponse } from "next/server"

import { sessionInputSchema } from "@/lib/training-sessions/validation"

import { errorResponse, isApiFailure, mutationFailed, parseJson, requireTsApiContext } from "./_shared"

const HTTP_CREATED = 201
const HTTP_FORBIDDEN = 403

export async function POST(request: Request) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  if (!context.teamId) return errorResponse("TS může vytvořit jen člen:ka týmu", HTTP_FORBIDDEN).response

  const input = await parseJson(request, sessionInputSchema)
  if (isApiFailure(input)) return input.response

  const { data, error } = await context.supabase
    .from("training_sessions")
    .insert({
      team_id: context.teamId,
      topic: input.topic,
      description: input.description,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      room_id: input.roomId,
      location_note: input.locationNote,
      guest_capacity: input.guestCapacity,
      created_by_profile_id: context.profileId,
      updated_by_profile_id: context.profileId,
    })
    .select("id")
    .single()
  if (error || !data) return mutationFailed(error).response

  if (input.facilitatorIds.length > 0) {
    const { error: facilitatorsError } = await context.supabase.from("training_session_facilitators").insert(
      input.facilitatorIds.map((profileId) => ({
        training_session_id: data.id,
        profile_id: profileId,
        created_by_profile_id: context.profileId,
      })),
    )
    if (facilitatorsError) return mutationFailed(facilitatorsError).response
  }

  return NextResponse.json({ data: { id: data.id } }, { status: HTTP_CREATED })
}
