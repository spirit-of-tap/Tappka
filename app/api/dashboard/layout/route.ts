import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { sanitizeWidgetIds } from "@/lib/dashboard/types";

/**
 * PUT /api/dashboard/layout
 * Save the current user's dashboard widget layout
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getCurrentUserProfile(supabase);

    if (!profile) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const body = await request.json();
    const widgets = sanitizeWidgetIds(body?.widgets, profile.role);

    const { error } = await supabase.from("dashboard_layouts").upsert({
      profile_id: profile.id,
      widgets,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error saving dashboard layout:", error);
      return NextResponse.json(
        { error: "Nepodařilo se uložit rozložení" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { widgets } });
  } catch (error) {
    console.error("PUT /api/dashboard/layout error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
