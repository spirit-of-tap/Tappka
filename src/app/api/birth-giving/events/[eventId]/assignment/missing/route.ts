import { NextResponse } from "next/server";

import { deleteFile } from "@/lib/storage/service";
import {
  birthGivingMutationErrorResponse,
  callBirthGivingRpc,
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../../../_shared";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;

  const { data: previousPath, error } = await callBirthGivingRpc<string>(
    context.supabase,
    "birth_giving_set_assignment",
    {
      p_event_id: eventId,
      p_state: "missing",
      p_storage_path: null,
      p_original_file_name: null,
      p_mime_type: null,
      p_file_size: null,
    },
  );

  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);

  if (previousPath) {
    try {
      await deleteFile("documents", previousPath);
    } catch (cleanupError) {
      console.error("Birth Giving assignment missing cleanup failed:", cleanupError);
      return NextResponse.json(
        { error: "Předchozí soubor zadání se nepodařilo odstranit" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ data: { state: "missing" } });
}