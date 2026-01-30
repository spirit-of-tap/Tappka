import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GET /r/[code]
 * Short URL redirect for QR codes
 * - If user is logged in -> /dashboard/reservations/[code]/qr
 * - If not logged in -> /rezervace/[code]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { code } = await params;
  const supabase = await createClient();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // Logged in -> redirect to QR quick status page
    const url = new URL(`/dashboard/reservations/${code}/qr`, request.url);
    return NextResponse.redirect(url);
  } else {
    // Not logged in -> redirect to public page
    const url = new URL(`/rezervace/${code}`, request.url);
    return NextResponse.redirect(url);
  }
}
