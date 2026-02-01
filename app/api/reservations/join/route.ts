import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface JoinRequest {
  reservation_id: string;
}

/**
 * POST /api/reservations/join
 * Join an open cowork reservation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const body: JoinRequest = await request.json();
    const { reservation_id } = body;

    if (!reservation_id) {
      return NextResponse.json(
        { error: "Chybí ID rezervace" },
        { status: 400 }
      );
    }

    // Check reservation exists and is open for cowork
    const { data: reservation } = await supabase
      .from("reservations")
      .select("id, user_id, is_cowork_open, status, start_time, end_time")
      .eq("id", reservation_id)
      .single();

    if (!reservation) {
      return NextResponse.json(
        { error: "Rezervace nenalezena" },
        { status: 404 }
      );
    }

    if (reservation.status !== "active") {
      return NextResponse.json(
        { error: "Rezervace není aktivní" },
        { status: 400 }
      );
    }

    if (!reservation.is_cowork_open) {
      return NextResponse.json(
        { error: "Tato rezervace není otevřená pro cowork" },
        { status: 400 }
      );
    }

    // Get current user's profile ID
    const profile = await getCurrentUserProfile(supabase);
    if (!profile) {
      return NextResponse.json(
        { error: "Uživatelský profil nenalezen" },
        { status: 403 }
      );
    }

    // Can't join your own reservation
    if (reservation.user_id === profile?.id) {
      return NextResponse.json(
        { error: "Nemůžeš se připojit k vlastní rezervaci" },
        { status: 400 }
      );
    }

    // Check if reservation is in the future or happening now
    const now = new Date();
    const endTime = new Date(reservation.end_time);
    if (endTime < now) {
      return NextResponse.json(
        { error: "Rezervace již skončila" },
        { status: 400 }
      );
    }

    // Check if user has conflicting reservation
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("id")
      .eq("user_id", profile?.id)
      .eq("status", "active")
      .lt("start_time", reservation.end_time)
      .gt("end_time", reservation.start_time);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: "V tomto čase máš jinou rezervaci" },
        { status: 409 }
      );
    }

    // Check if already joined
    const { data: existing } = await supabase
      .from("cowork_participants")
      .select("id")
      .eq("reservation_id", reservation_id)
      .eq("user_id", profile?.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Už jsi připojen/a k této rezervaci" },
        { status: 409 }
      );
    }

    // Join
    const { data: participant, error } = await supabase
      .from("cowork_participants")
      .insert({
        reservation_id,
        user_id: profile?.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error joining cowork:", error);
      return NextResponse.json(
        { error: "Nepodařilo se připojit" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: participant,
      message: "Připojeno ke coworku",
    });
  } catch (error) {
    console.error("POST /api/reservations/join error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reservations/join
 * Leave a cowork reservation
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    // Get current user's profile ID
    const profile = await getCurrentUserProfile(supabase);
    if (!profile) {
      return NextResponse.json(
        { error: "Uživatelský profil nenalezen" },
        { status: 403 }
      );
    }

    // Support both query params and JSON body
    let reservationId: string | null = null;

    // Try query params first
    const { searchParams } = new URL(request.url);
    reservationId = searchParams.get("reservation_id");

    // If not in query params, try JSON body
    if (!reservationId) {
      try {
        const body = await request.json();
        reservationId = body.reservation_id;
      } catch {
        // No body, that's fine
      }
    }

    if (!reservationId) {
      return NextResponse.json(
        { error: "Chybí ID rezervace" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("cowork_participants")
      .delete()
      .eq("reservation_id", reservationId)
      .eq("user_id", profile?.id);

    if (error) {
      console.error("Error leaving cowork:", error);
      return NextResponse.json(
        { error: "Nepodařilo se odejít" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Odešel/odešla jsi z coworku",
    });
  } catch (error) {
    console.error("DELETE /api/reservations/join error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
