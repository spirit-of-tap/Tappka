import { NextRequest } from "next/server";

import { birthGivingJoiningSchema } from "@/lib/birth-giving/api";

import {
  birthGivingMutationErrorResponse,
  invalidPayloadResponse,
  isBirthGivingApiGateFailure,
  refreshedEventResponse,
  requireBirthGivingApiContext,
} from "../../../_shared";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const parsed = birthGivingJoiningSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();

  const { data: event, error: readError } = await context.supabase
    .from("birth_giving_events")
    .select("name, customer, starts_at, duration, minimum_team_size, maximum_team_size, organizers:birth_giving_event_organizers(profile_id)")
    .eq("id", eventId)
    .single();
  if (readError) return birthGivingMutationErrorResponse(readError, context.supabase, eventId);

  const { error } = await context.supabase.rpc("birth_giving_upsert_draft", {
    p_customer: event.customer,
    p_duration: event.duration,
    p_event_id: eventId,
    p_joining_open: parsed.data.joiningOpen,
    p_maximum_team_size: event.maximum_team_size,
    p_minimum_team_size: event.minimum_team_size,
    p_name: event.name,
    p_organizer_profile_ids: event.organizers.map(({ profile_id }) => profile_id),
    p_starts_at: event.starts_at,
  });
  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return refreshedEventResponse(context.supabase, eventId);
}
