import { NextRequest } from "next/server";

import { birthGivingHistoricalTeamSchema } from "@/lib/birth-giving/api";

import {
  birthGivingMutationErrorResponse,
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
  const parsed = birthGivingHistoricalTeamSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();

  const { error } = await context.supabase.rpc("birth_giving_create_historical_team", {
    p_event_id: eventId,
    p_member_profile_ids: parsed.data.memberProfileIds,
    p_name: parsed.data.name,
    p_result_state: parsed.data.resultState,
  });
  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return refreshedEventResponse(context.supabase, eventId, 201);
}
