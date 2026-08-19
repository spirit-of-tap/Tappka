import { NextRequest } from "next/server";

import { birthGivingProposalSchema } from "@/lib/birth-giving/api";

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

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const parsed = birthGivingProposalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();

  const { error } = await context.supabase.rpc("birth_giving_create_proposal", {
    p_candidate_profile_id: parsed.data.candidateProfileId,
    p_direction: parsed.data.direction,
    p_event_id: eventId,
    p_team_id: parsed.data.teamId,
  });
  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return refreshedEventResponse(context.supabase, eventId, 201);
}
