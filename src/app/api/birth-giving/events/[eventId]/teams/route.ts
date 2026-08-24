import { NextRequest, NextResponse } from "next/server";

import { birthGivingTeamCreateSchema } from "@/lib/birth-giving/api";
import {
  birthGivingMutationErrorResponse,
  callBirthGivingRpc,
  invalidPayloadResponse,
  isBirthGivingApiGateFailure,
  refreshedEventResponse,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../../_shared";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;

  const parsed = birthGivingTeamCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();
  const payload = parsed.data;

  const { data: teamId, error } = await callBirthGivingRpc<string>(
    context.supabase,
    "birth_giving_create_team",
    {
      p_event_id: eventId,
      p_name: payload.name,
      p_member_profile_ids: payload.memberProfileIds,
    },
  );

  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  // The RPC returns the created team id; a missing row must never be reported
  // as a successful creation.
  if (!teamId) {
    return NextResponse.json({ error: "Akci se nepodařilo dokončit" }, { status: 500 });
  }

  return refreshedEventResponse(context.supabase, eventId, 201);
}
