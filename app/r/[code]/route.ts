import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GET /r/[code]
 * Short URL redirect for QR codes
 * Redirects to /rezervace/[code]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  
  // Redirect to the full URL
  const url = new URL(`/rezervace/${code}`, request.url);
  return NextResponse.redirect(url);
}
