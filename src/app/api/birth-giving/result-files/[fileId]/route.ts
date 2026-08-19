import { NextResponse } from "next/server";

import { deleteFile } from "@/lib/storage/service";

import {
  birthGivingMutationErrorResponse,
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../_shared";

interface RouteContext { params: Promise<{ fileId: string }> }

export async function DELETE(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { fileId } = await params;
  const invalidId = validateBirthGivingRouteIds(fileId);
  if (invalidId) return invalidId;
  const { data: path, error } = await context.supabase.rpc("birth_giving_remove_result_file", {
    p_result_file_id: fileId,
  });
  if (error) return birthGivingMutationErrorResponse(error, context.supabase);
  if (path) await deleteFile("documents", path).catch((deleteError: unknown) => {
    console.error("Failed to delete removed BG result object:", deleteError);
  });
  return NextResponse.json({ success: true });
}
