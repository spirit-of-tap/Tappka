import { NextRequest, NextResponse } from "next/server";

import {
  birthGivingFileSchema,
  extensionForBirthGivingMimeType,
  resultStoragePrefix,
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
} from "../../../../../../_shared";

interface RouteContext { params: Promise<{ eventId: string; teamId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId, teamId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId, teamId);
  if (invalidId) return invalidId;
  const parsed = birthGivingFileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();
  const { data: authorized, error } = await context.supabase.rpc("birth_giving_can_manage_result", {
    p_event_id: eventId,
    p_team_id: teamId,
  });
  if (error || !authorized) return NextResponse.json({ error: "Výsledky tohoto týmu nelze spravovat" }, { status: 403 });
  const extension = extensionForBirthGivingMimeType(parsed.data.mimeType);
  if (!extension) return invalidPayloadResponse();
  const key = generatePrivateStorageKey(resultStoragePrefix(eventId, teamId), extension);
  const data = await generatePresignedUploadForKey("documents", key);
  return NextResponse.json({ data });
}
