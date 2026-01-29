import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/room-issues/[id]
 * Resolve or update a room issue (coach/admin only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    // Check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["coach", "admin"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Nemáš oprávnění k této akci" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !["open", "resolved"].includes(status)) {
      return NextResponse.json(
        { error: "Neplatný status" },
        { status: 400 }
      );
    }

    // Check if issue exists
    const { data: existing } = await supabase
      .from("room_issues")
      .select("id, status")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Problém nenalezen" },
        { status: 404 }
      );
    }

    // Update issue
    const updateData: Record<string, unknown> = { status };
    
    if (status === "resolved") {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = user.id;
    } else {
      updateData.resolved_at = null;
      updateData.resolved_by = null;
    }

    const { data: updated, error } = await supabase
      .from("room_issues")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating room issue:", error);
      return NextResponse.json(
        { error: "Nepodařilo se aktualizovat problém" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: status === "resolved" ? "Problém vyřešen" : "Problém znovu otevřen",
    });
  } catch (error) {
    console.error("PATCH /api/room-issues/[id] error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/room-issues/[id]
 * Delete a room issue (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    // Check role - only admin can delete
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Pouze admin může mazat problémy" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("room_issues")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting room issue:", error);
      return NextResponse.json(
        { error: "Nepodařilo se smazat problém" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Problém smazán",
    });
  } catch (error) {
    console.error("DELETE /api/room-issues/[id] error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
