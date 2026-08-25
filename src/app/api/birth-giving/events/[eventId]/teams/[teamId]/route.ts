import { NextRequest } from "next/server";

import { birthGivingTeamUpdateSchema } from "@/lib/birth-giving/api";
import {
  birthGivingMutationErrorResponse,
  callBirthGivingRpc,
  invalidPayloadResponse,
  isBirthGivingApiGateFailure,
  refreshedEventResponse,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../../../_shared";

interface RouteContext {
  params: Promise<{ eventId: string; teamId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId, teamId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId, teamId);
  if (invalidId) return invalidId;

  const parsed = birthGivingTeamUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();
  const payload = parsed.data;

  const { error } = await callBirthGivingRpc(context.supabase, "birth_giving_update_team", {
    p_event_id: eventId,
    p_team_id: teamId,
    p_name: payload.name ?? null,
    p_member_profile_ids: payload.memberProfileIds ?? null,
    p_is_winner: payload.isWinner ?? null,
  });

  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return refreshedEventResponse(context.supabase, eventId);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId, teamId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId, teamId);
  if (invalidId) return invalidId;

  const { error } = await callBirthGivingRpc(context.supabase, "birth_giving_delete_team", {
    p_event_id: eventId,
    p_team_id: teamId,
  });

  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return refreshedEventResponse(context.supabase, eventId);
}
