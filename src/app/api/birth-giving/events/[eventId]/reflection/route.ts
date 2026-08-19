import { NextRequest, NextResponse } from "next/server";

import { birthGivingReflectionSchema } from "@/lib/birth-giving/api";

import {
  birthGivingMutationErrorResponse,
  invalidPayloadResponse,
  isBirthGivingApiGateFailure,
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

  const { data: reflectionId, error } = await context.supabase.rpc(
    "birth_giving_upsert_reflection",
    {
      p_contribution: parsed.data.contribution,
      p_event_id: eventId,
      p_learning: parsed.data.learning,
    },
  );
  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);

  const { data, error: readError } = await context.supabase
    .from("birth_giving_reflections")
    .select("*")
    .eq("id", reflectionId)
    .single();
  if (readError) return birthGivingMutationErrorResponse(readError, context.supabase, eventId);
  return NextResponse.json({ data });
}
