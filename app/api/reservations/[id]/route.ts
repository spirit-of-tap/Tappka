import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { UpdateReservationInput } from "@/lib/reservations/types";
import { getCurrentUserProfile } from "@/lib/auth-helpers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reservations/[id]
 * Get a single reservation
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { data: reservation, error } = await supabase
      .from("reservations")
      .select(`
        *,
        room:rooms(id, code, name),
        user:profiles(id, name),
        team:teams(id, name),
        cowork_participants(
          id,
          user_id,
          joined_at,
          user:profiles(id, name)
        )
      `)
      .eq("id", id)
      .single();

    if (error || !reservation) {
      return NextResponse.json(
        { error: "Rezervace nenalezena" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: reservation });
  } catch (error) {
    console.error("GET /api/reservations/[id] error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reservations/[id]
 * Update a reservation
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Check ownership
    const { data: existing } = await supabase
      .from("reservations")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Rezervace nenalezena" },
        { status: 404 }
      );
    }

    if (existing.user_id !== profile?.id) {
      return NextResponse.json(
        { error: "Nemáš oprávnění upravovat tuto rezervaci" },
        { status: 403 }
      );
    }

    const body: UpdateReservationInput = await request.json();
    const allowedFields = ["title", "person_count", "is_cowork_open"];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field as keyof UpdateReservationInput];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Žádné údaje k aktualizaci" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from("reservations")
      .update(updateData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Error updating reservation:", error);
      return NextResponse.json(
        { error: "Nepodařilo se aktualizovat rezervaci" },
        { status: 500 }
      );
    }

    // Check if the update actually happened (RLS might silently block it)
    if (!updated) {
      console.error("Update blocked by RLS - no rows affected", { 
        reservationId: id, 
        profileId: profile?.id,
        existingUserId: existing.user_id 
      });
      return NextResponse.json(
        { error: "Nepodařilo se aktualizovat rezervaci - chyba oprávnění" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Rezervace aktualizována",
    });
  } catch (error) {
    console.error("PATCH /api/reservations/[id] error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reservations/[id]
 * Delete a reservation
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Check ownership
    const { data: existing } = await supabase
      .from("reservations")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Rezervace nenalezena" },
        { status: 404 }
      );
    }

    if (existing.user_id !== profile?.id) {
      return NextResponse.json(
        { error: "Nemáš oprávnění smazat tuto rezervaci" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("reservations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting reservation:", error);
      return NextResponse.json(
        { error: "Nepodařilo se smazat rezervaci" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Rezervace smazána",
    });
  } catch (error) {
    console.error("DELETE /api/reservations/[id] error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
