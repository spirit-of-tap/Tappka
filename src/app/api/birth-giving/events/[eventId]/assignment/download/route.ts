import { NextResponse } from "next/server";

import { getSignedStorageUrl } from "@/lib/storage/service";

import {
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../../../_shared";

const DOWNLOAD_EXPIRY_SECONDS = 60;
interface RouteContext { params: Promise<{ eventId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { eventId } = await params;
  const invalidId = validateBirthGivingRouteIds(eventId);
  if (invalidId) return invalidId;
  const { data, error } = await context.supabase
    .from("birth_giving_assignments")
    .select("storage_path")
    .eq("event_id", eventId)
    .eq("state", "present")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Zadání se nepodařilo načíst" }, { status: 500 });
  if (!data?.storage_path) return NextResponse.json({ error: "Zadání zatím není zveřejněné" }, { status: 409 });
  const url = await getSignedStorageUrl("documents", data.storage_path, DOWNLOAD_EXPIRY_SECONDS);
  return NextResponse.redirect(url, 307);
}
