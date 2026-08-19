import { NextResponse } from "next/server";

import {
  birthGivingMutationErrorResponse,
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../../../../../_shared";

interface RouteContext { params: Promise<{ eventId: string; teamId: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId, teamId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId, teamId);
  if (invalidId) return invalidId;
  const { error } = await context.supabase.rpc("birth_giving_mark_result_missing", {
    p_event_id: eventId,
    p_team_id: teamId,
  });
  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return NextResponse.json({ data: { state: "missing" } });
}
