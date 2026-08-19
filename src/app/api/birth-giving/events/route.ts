import { NextRequest, NextResponse } from "next/server";

import { birthGivingDraftSchema, BIRTH_GIVING_ERROR_CODES } from "@/lib/birth-giving/api";
import { normalizeEventIdentity } from "@/lib/birth-giving/identity";

import {
  birthGivingMutationErrorResponse,
  invalidPayloadResponse,
  isBirthGivingApiGateFailure,
  refreshedEventResponse,
  requireBirthGivingApiContext,
} from "../_shared";

export async function POST(request: NextRequest) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;

  const parsed = birthGivingDraftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();
  const payload = parsed.data;
  const { data: eventId, error } = await context.supabase.rpc("birth_giving_create_draft", {
    p_customer: payload.customer,
    p_duration: payload.duration,
    p_joining_open: payload.joiningOpen,
    p_maximum_team_size: payload.maximumTeamSize,
    p_minimum_team_size: payload.minimumTeamSize,
    p_name: payload.name,
    p_organizer_profile_ids: payload.organizerProfileIds,
    p_starts_at: payload.startsAt,
  });

  if (error) {
    if (error.code === "23505") {
      const identity = normalizeEventIdentity({
        eventName: payload.name,
        customer: payload.customer,
        startsAt: new Date(payload.startsAt),
      });
      const { data } = await context.supabase.rpc("birth_giving_find_event_conflict", {
        p_normalized_customer: identity.customer,
        p_normalized_name: identity.eventName,
        p_starts_at: identity.startsAt,
      });
      const conflict = data?.[0];
      if (conflict) {
        return NextResponse.json(
          {
            code: BIRTH_GIVING_ERROR_CODES.duplicateEvent,
            error: "Stejná Birth Giving událost už existuje.",
            data: {
              id: conflict.id,
              status: conflict.status,
              identity,
            },
          },
          { status: 409 },
        );
      }
    }
    return birthGivingMutationErrorResponse(error, context.supabase);
  }

  return refreshedEventResponse(context.supabase, eventId, 201);
}
