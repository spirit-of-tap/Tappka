import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GET /r/[code]
 * Short URL redirect for QR codes
 * - If user is logged in -> reservations/[code]/qr
 * - If not logged in -> /rezervace/[code]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  const supabase = await createClient();

  // Check if user is logged in
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  if (user) {
    // Logged in -> redirect to quick status page
    const url = new URL(`/reservations/${code}/quick`, request.url);
    return NextResponse.redirect(url);
  } else {
    // Not logged in -> redirect to public page
    const url = new URL(`/rezervace/${code}`, request.url);
    return NextResponse.redirect(url);
  }
}
