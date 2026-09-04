import { NextRequest, NextResponse } from "next/server";

import {
  assignmentStoragePrefix,
  birthGivingConfirmedFileSchema,
} from "@/lib/birth-giving/files";
import { notifyParticipantsOfAssignment } from "@/lib/notifications/birth-giving-notifications";
import { deleteFile, inspectStorageObject } from "@/lib/storage/service";
import {
  birthGivingMutationErrorResponse,
  callBirthGivingRpc,
  invalidPayloadResponse,
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../../../_shared";
import { serverLogger } from "@/lib/server-logger";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;

  const parsed = birthGivingConfirmedFileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidPayloadResponse();
  const storagePath = parsed.data.storagePath;

  // The caller may only register an object they uploaded inside this event's
  // own assignment prefix; the RPC repeats this rule, so a mismatched or
  // missing object is a client error, never silently accepted.
  if (!storagePath.startsWith(assignmentStoragePrefix(eventId))) return invalidPayloadResponse();

  const object = await inspectStorageObject("documents", storagePath);
  if (!object) {
    return NextResponse.json({ error: "Nahraný soubor nebyl nalezen" }, { status: 409 });
  }
  // inspectStorageObject already normalizes the content type (strips
  // parameters) and reports integer byte size as a number; both must match the
  // metadata the caller claims for that pre-signed upload.
  if (object.size !== parsed.data.fileSize || object.contentType !== parsed.data.mimeType) {
    return NextResponse.json(
      { error: "Nahraný soubor neodpovídá potvrzeným údajům" },
      { status: 409 },
    );
  }

  // uploaded_at and uploaded_by are derived by the RPC, never accepted from
  // the caller. The RPC returns the previous storage path (if any) so the
  // displaced object can be removed after the database commit. Re-confirming
  // the very path just committed (retry after a lost response or a
  // double-submit) reports that same path back as "previous"; never delete it,
  // it is the object the row now references.
  const { data: previousPath, error } = await callBirthGivingRpc<string>(
    context.supabase,
    "birth_giving_set_assignment",
    {
      p_event_id: eventId,
      p_state: "present",
      p_storage_path: storagePath,
      p_original_file_name: parsed.data.originalFileName,
      p_mime_type: parsed.data.mimeType,
      p_file_size: parsed.data.fileSize,
    },
  );

  if (error) {
    try {
      await deleteFile("documents", storagePath);
    } catch (cleanupError) {
      serverLogger.console.error("Birth Giving assignment cleanup after failed confirm:", cleanupError);
    }
    return birthGivingMutationErrorResponse(error, context.supabase, eventId);
  }

  if (previousPath && previousPath !== storagePath) {
    try {
      await deleteFile("documents", previousPath);
    } catch (cleanupError) {
      serverLogger.console.error("Birth Giving assignment replacement cleanup failed:", cleanupError);
      return NextResponse.json(
        { error: "Předchozí soubor zadání se nepodařilo odstranit" },
        { status: 500 },
      );
    }
  }

  // The assignment is committed and may now be available-due; notify current
  // members so a replacement made after the event started reaches them
  // immediately. The helper itself checks published/due/present and returns 0
  // when nothing is due. A notification failure must not fail the confirm.
  try {
    await notifyParticipantsOfAssignment(eventId);
  } catch (notifyError) {
    serverLogger.console.error("Birth Giving assignment notification failed:", notifyError);
  }

  return NextResponse.json({ data: { storagePath } });
}
