import { NextRequest, NextResponse } from "next/server";

import { cleanupBirthGivingStorage } from "@/lib/birth-giving/storage-cleanup";
import { isAuthorizedCronRequest } from "@/lib/system/cron-auth";

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const data = await cleanupBirthGivingStorage();
  return NextResponse.json({ data });
}
