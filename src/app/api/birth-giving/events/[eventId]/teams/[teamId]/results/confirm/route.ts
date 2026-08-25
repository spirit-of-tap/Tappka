import { NextRequest, NextResponse } from "next/server";

import {
  birthGivingConfirmedFileSchema,
  resultStoragePrefix,
} from "@/lib/birth-giving/files";
import { deleteFile, inspectStorageObject } from "@/lib/storage/service";
import {
  birthGivingMutationErrorResponse,
  callBirthGivingRpc,
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

  const parsed = birthGivingConfirmedFileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();
  const storagePath = parsed.data.storagePath;

  if (!storagePath.startsWith(resultStoragePrefix(eventId, teamId))) return invalidPayloadResponse();

  const object = await inspectStorageObject("documents", storagePath);
  if (!object) {
    return NextResponse.json({ error: "Nahraný soubor nebyl nalezen" }, { status: 409 });
  }
  if (object.size !== parsed.data.fileSize || object.contentType !== parsed.data.mimeType) {
    return NextResponse.json(
      { error: "Nahraný soubor neodpovídá potvrzeným údajům" },
      { status: 409 },
    );
  }

  // uploaded_at and uploaded_by are derived by the RPC, never accepted from
  // the caller; the file id is generated server-side.
  const { data: fileId, error } = await callBirthGivingRpc<string>(
    context.supabase,
    "birth_giving_add_result_file",
    {
      p_event_id: eventId,
      p_team_id: teamId,
      p_storage_path: storagePath,
      p_original_file_name: parsed.data.originalFileName,
      p_mime_type: parsed.data.mimeType,
      p_file_size: parsed.data.fileSize,
    },
  );

  if (error || !fileId) {
    try {
      await deleteFile("documents", storagePath);
    } catch (cleanupError) {
      console.error("Birth Giving result cleanup after failed confirm:", cleanupError);
    }
    if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);
    return NextResponse.json({ error: "Akci se nepodařilo dokončit" }, { status: 500 });
  }

  return NextResponse.json({ data: { id: fileId } }, { status: 201 });
}