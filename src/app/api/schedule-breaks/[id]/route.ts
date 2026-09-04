import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { serverLogger } from "@/lib/server-logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/schedule-breaks/[id]
 * Delete a schedule break
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    // Get current user's profile ID
    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json(
        { error: "Uživatelský profil nenalezen" },
        { status: 403 }
      );
    }

    // Check if user is coach or admin

    if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 });
    }

    // Check if break exists
    const { data: breakData } = await supabase
      .from("schedule_breaks")
      .select("id")
      .eq("id", id)
      .single();

    if (!breakData) {
      return NextResponse.json({ error: "Výjimka nenalezena" }, { status: 404 });
    }

    // Delete the break
    const { error } = await supabase
      .from("schedule_breaks")
      .delete()
      .eq("id", id);

    if (error) {
      serverLogger.console.error("Error deleting schedule break:", error);
      return NextResponse.json({ error: "Nepodařilo se smazat výjimku" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Výjimka smazána",
    });
  } catch (error) {
    serverLogger.console.error("DELETE /api/schedule-breaks/[id] error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
