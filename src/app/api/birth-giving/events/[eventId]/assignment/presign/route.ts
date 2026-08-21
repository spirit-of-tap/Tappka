import { NextRequest, NextResponse } from "next/server";

import {
  assignmentStoragePrefix,
  birthGivingFileSchema,
  extensionForBirthGivingMimeType,
} from "@/lib/birth-giving/files";
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

interface RouteContext { params: Promise<{ eventId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;
  const parsed = birthGivingFileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();

  const { data: authorized, error } = await context.supabase.rpc("birth_giving_can_manage_assignment", {
    p_event_id: eventId,
  });
  if (error || !authorized) return NextResponse.json({ error: "Zadání pro tuto událost nelze spravovat" }, { status: 403 });
  const extension = extensionForBirthGivingMimeType(parsed.data.mimeType);
  if (!extension) return invalidPayloadResponse();
  const key = generatePrivateStorageKey(assignmentStoragePrefix(eventId), extension);
  const data = await generatePresignedUploadForKey("documents", key);
  return NextResponse.json({ data });
}
