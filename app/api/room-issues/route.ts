import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { IssueType } from "@/lib/reservations/types";

interface CreateIssueInput {
  room_id: string;
  issue_type: IssueType;
  description?: string | null;
}

/**
 * GET /api/room-issues
 * Fetch room issues with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("room_id");
    const status = searchParams.get("status");

    let query = supabase
      .from("room_issues")
      .select(`
        *,
        room:rooms(id, code, name),
        reporter:profiles!reported_by(id, full_name),
        resolver:profiles!resolved_by(id, full_name)
      `)
      .order("created_at", { ascending: false });

    if (roomId) {
      query = query.eq("room_id", roomId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching room issues:", error);
      return NextResponse.json(
        { error: "Nepodařilo se načíst problémy" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/room-issues error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/room-issues
 * Report a new room issue
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const body: CreateIssueInput = await request.json();
    const { room_id, issue_type, description } = body;

    // Validation
    if (!room_id || !issue_type) {
      return NextResponse.json(
        { error: "Chybí povinné údaje" },
        { status: 400 }
      );
    }

    const validIssueTypes: IssueType[] = ["locked", "mess", "technical", "other"];
    if (!validIssueTypes.includes(issue_type)) {
      return NextResponse.json(
        { error: "Neplatný typ problému" },
        { status: 400 }
      );
    }

    // Check room exists
    const { data: room } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", room_id)
      .single();

    if (!room) {
      return NextResponse.json(
        { error: "Místnost neexistuje" },
        { status: 404 }
      );
    }

    // Check if there's already an open issue of the same type
    const { data: existingIssue } = await supabase
      .from("room_issues")
      .select("id")
      .eq("room_id", room_id)
      .eq("issue_type", issue_type)
      .eq("status", "open")
      .single();

    if (existingIssue) {
      return NextResponse.json(
        { error: "Tento typ problému je již nahlášen" },
        { status: 409 }
      );
    }

    // Create issue
    const { data: issue, error: insertError } = await supabase
      .from("room_issues")
      .insert({
        room_id,
        reported_by: user.id,
        issue_type,
        description: description || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating room issue:", insertError);
      return NextResponse.json(
        { error: "Nepodařilo se nahlásit problém" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: issue,
      message: "Problém nahlášen",
    });
  } catch (error) {
    console.error("POST /api/room-issues error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
