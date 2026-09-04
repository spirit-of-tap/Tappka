import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { getSignedStorageUrl } from "@/lib/storage/service";
import { serverLogger } from "@/lib/server-logger";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("personality_tests")
      .select("file_path, profile_id")
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });
    }

    if (data.profile_id !== profile.id) {
      return NextResponse.json({ error: "Nemáš oprávnění zobrazit tento test" }, { status: 403 });
    }

    const url = await getSignedStorageUrl("documents", data.file_path);
    return NextResponse.redirect(url, 307);
  } catch (error) {
    serverLogger.console.error("GET /api/personality-tests/[id]/open error:", error);
    return NextResponse.json({ error: "Nepodařilo se otevřít soubor" }, { status: 500 });
  }
}
