import { NextResponse } from "next/server";

import type { BirthGivingResultFile } from "@/lib/birth-giving/types";
import { getSignedStorageUrl } from "@/lib/storage/service";
import {
  isBirthGivingApiGateFailure,
  requireBirthGivingApiContext,
  validateBirthGivingRouteIds,
} from "../../../_shared";

const DOWNLOAD_EXPIRY_SECONDS = 60;

interface ResultFileTeamRow {
  result_files: BirthGivingResultFile[] | null;
}

interface RouteContext {
  params: Promise<{ fileId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const context = await requireBirthGivingApiContext();
  if (isBirthGivingApiGateFailure(context)) return context.response;
  const { fileId } = await params;
  const invalidId = validateBirthGivingRouteIds(fileId);
  if (invalidId) return invalidId;

  // The caller's own supabase client scopes the team rows through RLS, so the
  // embedded paths of teams the caller cannot see are never considered (and
  // never signed).
  const { data: teams, error } = await context.supabase
    .from("birth_giving_teams")
    .select("result_files");

  if (error || !teams) {
    return NextResponse.json({ error: "Soubor s výsledkem nebyl nalezen" }, { status: 404 });
  }

  const rows = teams as unknown as ResultFileTeamRow[];
  let targetFile: BirthGivingResultFile | null = null;
  for (const team of rows) {
    const found = (team.result_files ?? []).find((file) => file.id === fileId);
    if (found) {
      targetFile = found;
      break;
    }
  }

  if (!targetFile?.storage_path) {
    return NextResponse.json({ error: "Soubor s výsledkem nebyl nalezen" }, { status: 404 });
  }

  const url = await getSignedStorageUrl(
    "documents",
    targetFile.storage_path,
    DOWNLOAD_EXPIRY_SECONDS,
  );
  return NextResponse.redirect(url, 307);
}