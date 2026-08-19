import { NextResponse } from "next/server";

import {
  birthGivingMutationErrorResponse,
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../../../_shared";

interface RouteContext { params: Promise<{ eventId: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;
  const { error } = await context.supabase.rpc("birth_giving_mark_assignment_missing", {
    p_event_id: eventId,
  });
  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return NextResponse.json({ data: { state: "missing" } });
}
