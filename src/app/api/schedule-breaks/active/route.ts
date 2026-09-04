import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { serverLogger } from "@/lib/server-logger";

/**
 * GET /api/schedule-breaks/active
 * Get schedule breaks that are active during a date range
 * 
 * Query params:
 * - start_date: ISO date string
 * - end_date: ISO date string
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Chybí start_date nebo end_date" },
        { status: 400 }
      );
    }

    // Get breaks that overlap with the requested range
    const { data: breaks, error } = await supabase
      .from("schedule_breaks")
      .select("*")
      .lte("start_date", endDate)
      .gte("end_date", startDate)
      .order("start_date");

    if (error) {
      serverLogger.console.error("Error fetching schedule breaks:", error);
      return NextResponse.json(
        { error: "Nepodařilo se načíst výjimky" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: breaks });
  } catch (error) {
    serverLogger.console.error("GET /api/schedule-breaks/active error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
