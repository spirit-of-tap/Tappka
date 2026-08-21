import { NextRequest, NextResponse } from "next/server";

import { birthGivingDuplicateCheckSchema } from "@/lib/birth-giving/api";
import { findBirthGivingDuplicateCandidates } from "@/lib/birth-giving/queries";
import type { BirthGivingDuplicateCandidateItem } from "@/lib/birth-giving/types";

import {
  invalidPayloadResponse,
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
} from "../../_shared";

export async function POST(request: NextRequest) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;

  const parsed = birthGivingDuplicateCheckSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidPayloadResponse();
  const { name, customer, startsAt } = parsed.data;

  const candidates = await findBirthGivingDuplicateCandidates(context.supabase, {
    eventName: name,
    customer,
    startsAt: new Date(startsAt),
  });

  const data: BirthGivingDuplicateCandidateItem[] = candidates.map((event) => ({
    id: event.id,
    status: event.status,
    name: event.name,
    customer: event.customer,
    starts_at: event.starts_at,
  }));

  return NextResponse.json({ data });
}