import { NextRequest, NextResponse } from "next/server";

import { birthGivingEventPatchSchema } from "@/lib/birth-giving/api";
import { getBirthGivingEvent } from "@/lib/birth-giving/queries";

import {
  birthGivingMutationErrorResponse,
  invalidPayloadResponse,
  isBirthGivingApiGateFailure,
  refreshedEventResponse,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../_shared";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;
  const data = await getBirthGivingEvent(context.supabase, eventId);
  if (!data) return NextResponse.json({ error: "Událost nebyla nalezena" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;
  const parsed = birthGivingEventPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();
  const payload = parsed.data;

  const { error } = await context.supabase.rpc("birth_giving_update_event", {
    p_customer: payload.customer,
    p_duration: payload.duration,
    p_event_id: eventId,
    p_joining_open: payload.joiningOpen,
    p_maximum_team_size: payload.maximumTeamSize,
    p_minimum_team_size: payload.minimumTeamSize,
    p_name: payload.name,
    p_organizer_profile_ids: payload.organizerProfileIds,
    p_starts_at: payload.startsAt,
  });
  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return refreshedEventResponse(context.supabase, eventId);
}
