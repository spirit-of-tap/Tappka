import { NextResponse } from "next/server";

import { getSignedStorageUrl } from "@/lib/storage/service";

import {
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../../_shared";

const DOWNLOAD_EXPIRY_SECONDS = 60;
interface RouteContext { params: Promise<{ fileId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { fileId } = await params;
  const invalidId = validateBirthGivingRouteIds(fileId);
  if (invalidId) return invalidId;
  const { data, error } = await context.supabase
    .from("birth_giving_team_result_files")
    .select("storage_path")
    .eq("id", fileId)
    .is("removed_at", null)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Soubor s výsledkem nebyl nalezen" }, { status: 404 });
  const url = await getSignedStorageUrl("documents", data.storage_path, DOWNLOAD_EXPIRY_SECONDS);
  return NextResponse.redirect(url, 307);
}
