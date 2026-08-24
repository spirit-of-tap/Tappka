import { NextRequest, NextResponse } from "next/server";

import { birthGivingEventPatchSchema } from "@/lib/birth-giving/api";
import { getBirthGivingEvent } from "@/lib/birth-giving/queries";
import {
  birthGivingMutationErrorResponse,
  callBirthGivingRpc,
  invalidPayloadResponse,
  isBirthGivingApiGateFailure,
  refreshedEventResponse,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../_shared";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;
  const data = await getBirthGivingEvent(context.supabase, eventId);
  if (!data) return NextResponse.json({ error: "Událost nebyla nalezena" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;
  const parsed = birthGivingEventPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();
  const payload = parsed.data;

  // birth_giving_save_event is an upsert over the full event surface, so the
  // stored values fill in every field the patch leaves untouched.
  const current = await getBirthGivingEvent(context.supabase, eventId);
  if (!current) return NextResponse.json({ error: "Událost nebyla nalezena" }, { status: 404 });

  const { data: savedEventId, error } = await callBirthGivingRpc<string>(
    context.supabase,
    "birth_giving_save_event",
    {
      p_event_id: eventId,
      p_name: payload.name ?? current.name,
      p_customer: payload.customer ?? current.customer,
      p_starts_at: payload.startsAt ?? current.starts_at,
      p_duration: payload.duration ?? current.duration,
      p_organizer_profile_ids: payload.organizerProfileIds ?? current.organizer_profile_ids,
    },
  );

  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  if (!savedEventId) {
    return NextResponse.json({ error: "Akci se nepodařilo dokončit" }, { status: 500 });
  }

  return refreshedEventResponse(context.supabase, eventId);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;

  const { error } = await callBirthGivingRpc(context.supabase, "birth_giving_remove_event", {
    p_event_id: eventId,
  });

  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return NextResponse.json({ success: true });
}
