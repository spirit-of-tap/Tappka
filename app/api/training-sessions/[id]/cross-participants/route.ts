import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";

/**
 * POST /api/training-sessions/[id]/cross-participants
 * Join a training session as a cross participant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    // Get training session
    const { data: ts, error: tsError } = await supabase
      .from("training_sessions")
      .select("id, team_id, cross_slots_available")
      .eq("id", id)
      .single();

    if (tsError || !ts) {
      return NextResponse.json({ error: "Training Session nenalezen" }, { status: 404 });
    }

    // Check if user is from a different team
    if (profile.team_id === ts.team_id) {
      return NextResponse.json({ error: "Nemůžeš se připojit jako cross k vlastnímu týmu" }, { status: 400 });
    }

    // Check if user is already a cross participant
    const { data: existing } = await supabase
      .from("training_session_cross_participants")
      .select("id")
      .eq("training_session_id", id)
      .eq("user_id", profile.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Už jsi přihlášen jako cross" }, { status: 400 });
    }

    // Check if there are available slots
    const { count } = await supabase
      .from("training_session_cross_participants")
      .select("*", { count: "exact", head: true })
      .eq("training_session_id", id);

    if (count !== null && count >= ts.cross_slots_available) {
      return NextResponse.json({ error: "Všechna cross místa jsou obsazená" }, { status: 400 });
    }

    // Add user as cross participant
    const { data, error } = await supabase
      .from("training_session_cross_participants")
      .insert({
        training_session_id: id,
        user_id: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding cross participant:", error);
      return NextResponse.json({ error: "Nepodařilo se přihlásit jako cross" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: "Přihlášen jako cross participant",
    });
  } catch (error) {
    console.error("POST /api/training-sessions/[id]/cross-participants error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

/**
 * DELETE /api/training-sessions/[id]/cross-participants
 * Leave a training session as a cross participant
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    // Delete cross participant entry
    const { error } = await supabase
      .from("training_session_cross_participants")
      .delete()
      .eq("training_session_id", id)
      .eq("user_id", profile.id);

    if (error) {
      console.error("Error removing cross participant:", error);
      return NextResponse.json({ error: "Nepodařilo se odhlásit z cross" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Odhlášen z cross",
    });
  } catch (error) {
    console.error("DELETE /api/training-sessions/[id]/cross-participants error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
