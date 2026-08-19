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

  const { error } = await context.supabase.rpc("birth_giving_update_event", {
    p_event_id: eventId,
    p_joining_open: parsed.data.joiningOpen,
  });
  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return refreshedEventResponse(context.supabase, eventId);
}
