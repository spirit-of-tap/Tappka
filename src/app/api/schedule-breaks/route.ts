import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { TRAINING_SESSION_TITLE_PREFIX } from "@/lib/reservations/types";

interface CreateBreakInput {
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
}

/**
 * POST /api/schedule-breaks
 * Create a new schedule break and cancel overlapping TS reservations
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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
    if (profile.role !== "coach" && profile.role !== "admin") {
      return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 });
    }

    const body: CreateBreakInput = await request.json();
    const { name, start_date, end_date } = body;

    // Validation
    if (!name || !start_date || !end_date) {
      return NextResponse.json({ error: "Chybí povinné údaje" }, { status: 400 });
    }

    // Create schedule break
    const { data: breakData, error: breakError } = await supabase
      .from("schedule_breaks")
      .insert({
        name: name.trim(),
        start_date,
        end_date,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .select()
      .single();

    if (breakError) {
      console.error("Error creating schedule break:", breakError);
      return NextResponse.json({ error: "Nepodařilo se vytvořit výjimku" }, { status: 500 });
    }

    // Soft-cancel existing TS reservations in this period (admin: null owners)
    const startDateTime = `${start_date}T00:00:00`;
    const endDateTime = `${end_date}T23:59:59`;
    const adminClient = createAdminClient();

    const { data: toCancel } = await adminClient
      .from("reservations")
      .select("id, title")
      .is("cancelled_at", null)
      .gte("start_at", startDateTime)
      .lte("start_at", endDateTime)
      .like("title", `${TRAINING_SESSION_TITLE_PREFIX}%`);

    let cancelledCount = 0;
    if (toCancel && toCancel.length > 0) {
      const now = new Date().toISOString();
      const { data: cancelledReservations, error: cancelError } = await adminClient
        .from("reservations")
        .update({
          cancelled_at: now,
          cancelled_by_profile_id: profile.id,
          updated_by_profile_id: profile.id,
        })
        .in(
          "id",
          toCancel.map((r) => r.id)
        )
        .select("id");

      if (cancelError) {
        console.error("Error cancelling reservations:", cancelError);
      } else {
        cancelledCount = cancelledReservations?.length ?? 0;
      }
    }

    return NextResponse.json({
      success: true,
      data: breakData,
      reservations_cancelled: cancelledCount,
      message: cancelledCount > 0
        ? `Vytvořeno. Zrušeno ${cancelledCount} TS rezervací.`
        : "Vytvořeno",
    });
  } catch (error) {
    console.error("POST /api/schedule-breaks error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

/**
 * GET /api/schedule-breaks
 * List schedule breaks
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("schedule_breaks")
      .select("*")
      .order("start_date");

    if (error) {
      console.error("Error fetching schedule breaks:", error);
      return NextResponse.json({ error: "Nepodařilo se načíst výjimky" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/schedule-breaks error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
