import { NextRequest } from "next/server";

import { birthGivingReflectionSchema } from "@/lib/birth-giving/api";

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

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const parsed = birthGivingReflectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();

  const { error } = await context.supabase.rpc(
    "birth_giving_upsert_reflection",
    {
      p_contribution: parsed.data.contribution,
      p_event_id: eventId,
      p_learning: parsed.data.learning,
    },
  );
  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);

  return refreshedEventResponse(context.supabase, eventId);
}
