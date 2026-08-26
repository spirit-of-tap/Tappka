import { NextResponse } from "next/server";

import { getSignedStorageUrl } from "@/lib/storage/service";
import {
  callBirthGivingRpc,
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../../../_shared";

const DOWNLOAD_EXPIRY_SECONDS = 60;

interface VisibleAssignmentRow {
  assignment_state: string | null;
  assignment_storage_path: string | null;
}

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;

  // The visibility RPC enforces the assignment embargo server-side: before
  // starts_at a non-organizer only ever receives a 'none'/NULL row, and a
  // draft/removed/nonexistent event returns no row at all.
  const { data, error } = await callBirthGivingRpc<VisibleAssignmentRow[]>(
    context.supabase,
    "birth_giving_get_visible_assignment",
    { p_event_id: eventId },
  );

  if (error) {
    return NextResponse.json({ error: "Zadání se nepodařilo načíst" }, { status: 500 });
  }

  const assignment = Array.isArray(data) ? data[0] : null;
  if (!assignment || assignment.assignment_state !== "present" || !assignment.assignment_storage_path) {
    return NextResponse.json({ error: "Zadání zatím není k dispozici" }, { status: 404 });
  }

  const url = await getSignedStorageUrl(
    "documents",
    assignment.assignment_storage_path,
    DOWNLOAD_EXPIRY_SECONDS,
  );
  return NextResponse.redirect(url, 307);
}