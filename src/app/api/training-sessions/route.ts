import { NextResponse } from "next/server"

import { serverLogger } from "@/lib/server-logger"
import { listDiscoverPage } from "@/lib/training-sessions/discover"
import { DISCOVER_SEARCH_PARAMS, parseDiscoverFilter, parseDiscoverYear } from "@/lib/training-sessions/discover-params"
import { sessionInputSchema } from "@/lib/training-sessions/validation"

import { errorResponse, isApiFailure, mutationFailed, parseJson, requireTeamFacilitators, requireTsApiContext } from "./_shared"

const HTTP_CREATED = 201
const HTTP_FORBIDDEN = 403
const HTTP_SERVER_ERROR = 500

export async function GET(request: Request) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response

  try {
    const { searchParams } = new URL(request.url)
    const rawOffset = Number(searchParams.get("offset") ?? "0")
    const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0
    const query = {
      filter: parseDiscoverFilter(searchParams.get(DISCOVER_SEARCH_PARAMS.filter) ?? undefined),
      year: parseDiscoverYear(searchParams.get(DISCOVER_SEARCH_PARAMS.year) ?? undefined),
      q: (searchParams.get(DISCOVER_SEARCH_PARAMS.query) ?? "").trim(),
    }
    const page = await listDiscoverPage(
      context.supabase,
      { profileId: context.profileId, teamId: context.teamId },
      query,
      { offset },
    )
    return NextResponse.json(page)
  } catch (error) {
    serverLogger.console.error("Failed to load the TS discover feed:", error)
    return errorResponse("Feed se nepodařilo načíst", HTTP_SERVER_ERROR).response
  }
}

export async function POST(request: Request) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  if (!context.teamId) return errorResponse("TS může vytvořit jen člen:ka týmu", HTTP_FORBIDDEN).response

  const input = await parseJson(request, sessionInputSchema)
  if (isApiFailure(input)) return input.response
  const facilitatorsFailure = await requireTeamFacilitators(context, input.facilitatorIds)
  if (facilitatorsFailure) return facilitatorsFailure.response

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
      [...new Set(input.facilitatorIds)].map((profileId) => ({
        training_session_id: data.id,
        profile_id: profileId,
        created_by_profile_id: context.profileId,
      })),
    )
    if (facilitatorsError) return mutationFailed(facilitatorsError).response
  }

  return NextResponse.json({ data: { id: data.id } }, { status: HTTP_CREATED })
}
