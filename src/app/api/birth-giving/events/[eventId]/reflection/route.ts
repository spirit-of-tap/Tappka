import { NextRequest } from "next/server";

import { birthGivingReflectionSchema } from "@/lib/birth-giving/api";
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

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;
  const parsed = birthGivingReflectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();
  const payload = parsed.data;

  const { error } = await callBirthGivingRpc(context.supabase, "birth_giving_upsert_reflection", {
    p_event_id: eventId,
    p_contribution: payload.contribution,
    p_learning: payload.learning,
  });

  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return refreshedEventResponse(context.supabase, eventId);
}
