import { NextResponse } from "next/server";

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
  const { error } = await context.supabase.rpc("birth_giving_remove_result_file", {
    p_result_file_id: fileId,
  });
  if (error) return birthGivingMutationErrorResponse(error, context.supabase);
  return NextResponse.json({ success: true });
}
