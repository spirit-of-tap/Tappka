import { NextRequest } from "next/server";

import { birthGivingLookingForTeamSchema } from "@/lib/birth-giving/api";

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

export async function PUT(request: NextRequest, routeContext: RouteContext) {
  return setLookingForTeam(request, routeContext);
}

export async function DELETE(_request: NextRequest, routeContext: RouteContext) {
  return setLookingForTeam(null, routeContext, false);
}

async function setLookingForTeam(
  request: NextRequest | null,
  { params }: RouteContext,
  fixedLooking?: boolean,
) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const parsed = birthGivingLookingForTeamSchema.safeParse(
    fixedLooking === undefined ? await request?.json().catch(() => null) : { looking: fixedLooking },
  );
  if (!parsed.success) return invalidPayloadResponse();

  const { error } = await context.supabase.rpc("birth_giving_set_looking_for_team", {
    p_event_id: eventId,
    p_looking: parsed.data.looking,
  });
  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return refreshedEventResponse(context.supabase, eventId);
}
