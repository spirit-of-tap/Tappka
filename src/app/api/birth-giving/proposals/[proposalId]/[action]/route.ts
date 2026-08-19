import { NextResponse } from "next/server";

import {
  birthGivingMutationErrorResponse,
  isBirthGivingApiGateFailure,
  refreshedEventResponse,
  requireBirthGivingApiContext,
} from "../../../_shared";

const PROPOSAL_ACTIONS = ["accept", "reject", "cancel"] as const;
type ProposalAction = (typeof PROPOSAL_ACTIONS)[number];

interface RouteContext {
  params: Promise<{ proposalId: string; action: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { proposalId, action } = await params;
  if (!isProposalAction(action)) {
    return NextResponse.json({ error: "Neplatná akce návrhu" }, { status: 400 });
  }

  const { data: proposal, error: readError } = await context.supabase
    .from("birth_giving_team_proposals")
    .select("event_id")
    .eq("id", proposalId)
    .single();
  if (readError) return birthGivingMutationErrorResponse(readError, context.supabase);

  const { error } = await context.supabase.rpc("birth_giving_resolve_proposal", {
    p_action: action,
    p_proposal_id: proposalId,
  });
  if (error) {
    return birthGivingMutationErrorResponse(error, context.supabase, proposal.event_id);
  }
  return refreshedEventResponse(context.supabase, proposal.event_id);
}

function isProposalAction(action: string): action is ProposalAction {
  return (PROPOSAL_ACTIONS as readonly string[]).includes(action);
}
