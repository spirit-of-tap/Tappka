import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { validateContactInput } from "@/lib/profile/contact-validation";
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
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Neplatný požadavek" }, { status: 400 });
    }

    const result = validateContactInput(body);
    if (!result.ok) {
      return NextResponse.json({ error: "Zkontroluj zadané údaje", fieldErrors: result.errors }, { status: 400 });
    }

    const { error } = await supabase.from("profiles").update(result.value).eq("id", profile.id);
    if (error) throw error;
    return NextResponse.json(result.value);
  } catch (error) {
    serverLogger.console.error("PATCH /api/profile/contact error:", error);
    return NextResponse.json({ error: "Nepodařilo se uložit kontakt" }, { status: 500 });
  }
}
