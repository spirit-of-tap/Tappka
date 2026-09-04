import { NextResponse } from "next/server";

import { deleteFile } from "@/lib/storage/service";
import {
  birthGivingMutationErrorResponse,
  callBirthGivingRpc,
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../_shared";
import { serverLogger } from "@/lib/server-logger";

interface RouteContext {
  params: Promise<{ fileId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { fileId } = await params;
  const invalidId = validateBirthGivingRouteIds(fileId);
  if (invalidId) return invalidId;

  const { data: storagePath, error } = await callBirthGivingRpc<string>(
    context.supabase,
    "birth_giving_remove_result_file",
    { p_result_file_id: fileId },
  );

  if (error) return birthGivingMutationErrorResponse(error, context.supabase);

  if (storagePath) {
    try {
      await deleteFile("documents", storagePath);
    } catch (cleanupError) {
      serverLogger.console.error("Birth Giving result file removal cleanup failed:", cleanupError);
      return NextResponse.json(
        { error: "Soubor s výsledkem se nepodařilo odstranit" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}