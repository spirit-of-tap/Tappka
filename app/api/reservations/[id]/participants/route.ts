import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/reservations/[id]/participants
 * Get all participants of a cowork reservation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizovaný přístup" }, { status: 401 });
    }

    // Fetch participants with user info
    const { data: participants, error } = await supabase
      .from("cowork_participants")
      .select(`
        id,
        reservation_id,
        user_id,
        joined_at,
        user:profiles!cowork_participants_user_id_fkey(id, full_name)
      `)
      .eq("reservation_id", id)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("Error fetching participants:", error);
      return NextResponse.json(
        { error: "Nepodařilo se načíst účastníky" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: participants });
  } catch (error) {
    console.error("Participants API error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
