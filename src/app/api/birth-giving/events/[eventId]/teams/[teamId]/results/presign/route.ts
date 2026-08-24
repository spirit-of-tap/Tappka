import { NextRequest, NextResponse } from "next/server";

import { birthGivingFileSchema, extensionForBirthGivingMimeType, resultStoragePrefix } from "@/lib/birth-giving/files";
import { isBirthGivingOrganizer } from "@/lib/birth-giving/permissions";
import {
  generatePresignedUploadForKey,
  generatePrivateStorageKey,
} from "@/lib/storage/service";

import {
  invalidPayloadResponse,
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../../../../../_shared";

interface RouteContext {
  params: Promise<{ eventId: string; teamId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId, teamId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId, teamId);
  if (invalidId) return invalidId;
  const parsed = birthGivingFileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();

  // Check if member or organizer
  const { data: member } = await context.supabase
    .from("birth_giving_team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("profile_id", context.profileId)
    .maybeSingle();

  const { data: event } = await context.supabase
    .from("birth_giving_events")
    .select("organizer_profile_ids")
    .eq("id", eventId)
    .maybeSingle();

  const isOrganizer = event ? isBirthGivingOrganizer(event, context.profileId) : false;

  if (!member && !isOrganizer) {
    return NextResponse.json({ error: "Výsledky tohoto týmu nelze spravovat" }, { status: 403 });
  }

  const extension = extensionForBirthGivingMimeType(parsed.data.mimeType);
  if (!extension) return invalidPayloadResponse();
  const key = generatePrivateStorageKey(resultStoragePrefix(eventId, teamId), extension);
  const data = await generatePresignedUploadForKey("documents", key);
  return NextResponse.json({ data });
}

