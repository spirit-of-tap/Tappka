import { NextRequest } from "next/server";

import { birthGivingDraftSchema } from "@/lib/birth-giving/api";
import { normalizeEventIdentity } from "@/lib/birth-giving/identity";

import {
  birthGivingIdentityConflictResponse,
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
      return birthGivingIdentityConflictResponse(context.supabase, identity);
    }
    return birthGivingMutationErrorResponse(error, context.supabase);
  }

  return refreshedEventResponse(context.supabase, eventId, 201);
}
