import { NextResponse } from "next/server";

import { processBirthGiving } from "@/lib/notifications/birth-giving-notifications";
import { isAuthorizedCronRequest } from "@/lib/system/cron-auth";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const data = await processBirthGiving();
  return NextResponse.json({ data });
}
