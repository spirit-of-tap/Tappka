import { NextResponse } from "next/server";

import { deleteFile } from "@/lib/storage/service";
import {
  birthGivingMutationErrorResponse,
  callBirthGivingRpc,
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../../../../../_shared";
import { serverLogger } from "@/lib/server-logger";

interface RouteContext {
  params: Promise<{ eventId: string; teamId: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId, teamId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId, teamId);
  if (invalidId) return invalidId;

  const { data: clearedPaths, error } = await callBirthGivingRpc<string[]>(
    context.supabase,
    "birth_giving_mark_result_missing",
    { p_event_id: eventId, p_team_id: teamId },
  );

  if (error) return birthGivingMutationErrorResponse(error, context.supabase, eventId);

  const cleanupFailures: unknown[] = [];
  await Promise.all(
    (clearedPaths ?? []).map(async (storagePath) => {
      if (!storagePath) return;
      try {
        await deleteFile("documents", storagePath);
      } catch (cleanupError) {
        cleanupFailures.push(cleanupError);
      }
    }),
  );

  if (cleanupFailures.length > 0) {
    serverLogger.console.error("Birth Giving result missing cleanup failed:", cleanupFailures);
    return NextResponse.json(
      { error: "Nahrané soubory s výsledky se nepodařilo odstranit" },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { state: "missing" } });
}