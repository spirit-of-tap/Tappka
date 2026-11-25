import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { validateGreetingName } from "@/lib/profile/greeting-name";
import { serverLogger } from "@/lib/server-logger";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });

    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null || !("preferred_name" in body)) {
      return NextResponse.json({ error: "Neplatný požadavek" }, { status: 400 });
    }

    const result = validateGreetingName((body as { preferred_name: unknown }).preferred_name);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const { error } = await supabase
      .from("profiles")
      .update({ preferred_name: result.value })
      .eq("id", profile.id);
    if (error) throw error;
    return NextResponse.json({ preferred_name: result.value });
  } catch (error) {
    serverLogger.console.error("PATCH /api/profile/greeting error:", error);
    return NextResponse.json({ error: "Nepodařilo se uložit oslovení" }, { status: 500 });
  }
}
