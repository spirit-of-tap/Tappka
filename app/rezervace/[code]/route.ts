import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GET /rezervace/[code]
 * Redirect to quick status page
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  const url = new URL(`/reservations/${code}/quick`, request.url);
  return NextResponse.redirect(url, 308);
}
