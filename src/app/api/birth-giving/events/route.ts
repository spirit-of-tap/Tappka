import { NextRequest, NextResponse } from "next/server";

import { birthGivingEventCreateSchema } from "@/lib/birth-giving/api";
import {
  birthGivingMutationErrorResponse,
  callBirthGivingRpc,
  invalidPayloadResponse,
  isBirthGivingApiGateFailure,
  refreshedEventResponse,
  requireBirthGivingApiContext,
} from "../_shared";

export async function POST(request: NextRequest) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;

  const parsed = birthGivingEventCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();
  const payload = parsed.data;

  const { data: eventId, error } = await callBirthGivingRpc<string>(
    context.supabase,
    "birth_giving_save_event",
    {
      p_event_id: null,
      p_name: payload.name,
      p_customer: payload.customer,
      p_starts_at: payload.startsAt,
      p_duration: payload.duration,
      p_organizer_profile_ids: payload.organizerProfileIds,
    },
  );

  if (error) return birthGivingMutationErrorResponse(error, context.supabase);
  // The RPC returns the created id; a missing row must never be reported as a
  // successful creation.
  if (!eventId) {
    return NextResponse.json({ error: "Akci se nepodařilo dokončit" }, { status: 500 });
  }

  return refreshedEventResponse(context.supabase, eventId, 201);
}
