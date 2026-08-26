import { NextRequest, NextResponse } from "next/server";

import {
  assignmentStoragePrefix,
  birthGivingFileSchema,
  extensionForBirthGivingMimeType,
} from "@/lib/birth-giving/files";
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
} from "../../../../_shared";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;
  const parsed = birthGivingFileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();

  // The generated database types are stale until Task 10 regenerates them, so
  // the new organizer_profile_ids column is read through a narrow local shape.
  const { data: event } = (await context.supabase
    .from("birth_giving_events")
    .select("organizer_profile_ids")
    .eq("id", eventId)
    .maybeSingle()) as unknown as {
    data: { organizer_profile_ids: string[] } | null;
  };

  // Organizer membership is authoritative after creation; the creator-only
  // fallback is deliberately not honored here.
  if (!event || !isBirthGivingOrganizer(event, context.profileId)) {
    return NextResponse.json({ error: "Zadání pro tuto událost nelze spravovat" }, { status: 403 });
  }

  const extension = extensionForBirthGivingMimeType(parsed.data.mimeType);
  if (!extension) return invalidPayloadResponse();
  const key = generatePrivateStorageKey(assignmentStoragePrefix(eventId), extension);
  const data = await generatePresignedUploadForKey("documents", key);
  return NextResponse.json({ data });
}