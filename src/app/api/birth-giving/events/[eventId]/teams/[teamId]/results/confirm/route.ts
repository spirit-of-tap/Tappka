import { NextRequest, NextResponse } from "next/server";

import {
  birthGivingConfirmedFileSchema,
  resultStoragePrefix,
} from "@/lib/birth-giving/files";
import { BIRTH_GIVING_MAX_FILE_SIZE_BYTES } from "@/lib/birth-giving/constants";
import { validateBirthGivingFileContent } from "@/lib/birth-giving/file-signature";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadStorageObject, inspectStorageObject } from "@/lib/storage/service";

import {
  birthGivingMutationErrorResponse,
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
  const parsed = birthGivingConfirmedFileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.storagePath.startsWith(resultStoragePrefix(eventId, teamId))) {
    return invalidPayloadResponse();
  }
  const { data: authorized, error: authorizationError } = await context.supabase.rpc("birth_giving_can_manage_result", {
    p_event_id: eventId,
    p_team_id: teamId,
  });
  if (authorizationError || !authorized) {
    return NextResponse.json({ error: "Výsledky tohoto týmu nelze spravovat" }, { status: 403 });
  }
  const object = await inspectStorageObject("documents", parsed.data.storagePath);
  if (!object || object.size !== parsed.data.fileSize || object.contentType !== parsed.data.mimeType) {
    return NextResponse.json({ error: "Nahraný soubor neodpovídá potvrzeným údajům" }, { status: 409 });
  }
  const content = await downloadStorageObject("documents", parsed.data.storagePath, BIRTH_GIVING_MAX_FILE_SIZE_BYTES);
  if (!content || !await validateBirthGivingFileContent(content, parsed.data.mimeType)) {
    return NextResponse.json({ error: "Obsah nahraného souboru neodpovídá jeho typu" }, { status: 409 });
  }
  const { data: id, error } = await createAdminClient().rpc("birth_giving_confirm_result_file", {
    p_actor_profile_id: context.profileId,
    p_event_id: eventId,
    p_file_size: parsed.data.fileSize,
    p_mime_type: parsed.data.mimeType,
    p_original_file_name: parsed.data.originalFileName,
    p_storage_path: parsed.data.storagePath,
    p_team_id: teamId,
  });
  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  return NextResponse.json({ data: { id } }, { status: 201 });
}
