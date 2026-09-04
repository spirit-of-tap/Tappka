import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { addMonths, getDay, setHours, setMinutes, startOfMonth, addDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { HOUSTON_CALLING_TITLE } from "@/lib/reservations/types";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { serverLogger } from "@/lib/server-logger";

/**
 * Helper function to find first Wednesday of a month
 */
function getFirstWednesday(date: Date): Date {
  const firstDayOfMonth = startOfMonth(date);
  let firstWednesday = firstDayOfMonth;
  while (getDay(firstWednesday) !== 3) {
    firstWednesday = addDays(firstWednesday, 1);
  }
  return firstWednesday;
}

/**
 * Helper function to create HC reservation if it doesn't exist
 * Uses admin client to bypass RLS for system operations
 */
async function createHCForMonth(
  adminClient: SupabaseClient<Database>,
  roomId: string,
  targetDate: Date,
  scheduleBreaks: Array<{ start_date: string; end_date: string }>,
  actorProfileId: string
): Promise<{ created: boolean; date: Date; reason?: string }> {
  const firstWednesday = getFirstWednesday(targetDate);
  const dateStr = firstWednesday.toISOString().split("T")[0];

  // Check if this date falls within a schedule break
  const isBreak = scheduleBreaks.some(
    (b) => dateStr >= b.start_date && dateStr <= b.end_date
  );

  if (isBreak) {
    return { created: false, date: firstWednesday, reason: "schedule_break" };
  }

  // Check if HC already exists for this date (room + start_at window + title)
  const startOfDay = setMinutes(setHours(firstWednesday, 0), 0);
  const endOfDay = setMinutes(setHours(firstWednesday, 23), 59);

  const { data: existingHC } = await adminClient
    .from("reservations")
    .select("id")
    .eq("room_id", roomId)
    .eq("title", HOUSTON_CALLING_TITLE)
    .is("cancelled_at", null)
    .gte("start_at", startOfDay.toISOString())
    .lte("start_at", endOfDay.toISOString())
    .maybeSingle();

  if (existingHC) {
    return { created: false, date: firstWednesday, reason: "already_exists" };
  }

  // Set time to 9:00 - 12:00
  const startTime = setMinutes(setHours(firstWednesday, 9), 0);
  const endTime = setMinutes(setHours(firstWednesday, 12), 0);

  // Create HC reservation using admin client (bypasses RLS)
  const { error } = await adminClient.from("reservations").insert({
    room_id: roomId,
    owner_profile_id: null,
    title: HOUSTON_CALLING_TITLE,
    start_at: startTime.toISOString(),
    end_at: endTime.toISOString(),
    created_by_profile_id: actorProfileId,
    updated_by_profile_id: actorProfileId,
  });

  if (error) {
    serverLogger.console.error("Error creating Houston Calling:", error);
    return { created: false, date: firstWednesday, reason: "error" };
  }

  return { created: true, date: firstWednesday };
}

/**
 * Resolve a profile id to attribute system-generated HC rows.
 * Prefer the calling user; fall back to any admin for cron runs.
 */
async function resolveActorProfileId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminClient: SupabaseClient<Database>
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const profile = await getCurrentUserProfile(supabase, { user });
    if (profile?.id) return profile.id;
  }

  const { data: adminProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  return adminProfile?.id ?? null;
}

/**
 * POST /api/houston-calling/generate
 * Generate Houston Calling reservations for current and next 2 months
 * This can be called by any authenticated user (system operation)
 * Uses admin client to bypass RLS for creating system reservations
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Check for API key or require authentication
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // If called from cron, verify secret
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      if (cronSecret && token !== cronSecret) {
        return NextResponse.json({ error: "Neplatný token" }, { status: 401 });
      }
    } else {
      // If called by user, just verify they are authenticated
      // HC generation is a system task that benefits everyone
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
      }
    }

    const actorProfileId = await resolveActorProfileId(supabase, adminClient);
    if (!actorProfileId) {
      return NextResponse.json(
        { error: "Nelze určit profil pro systémové rezervace" },
        { status: 500 }
      );
    }

    // Get D107 room using admin client (bypasses RLS)
    const { data: room } = await adminClient
      .from("rooms")
      .select("id")
      .eq("code", "d107")
      .is("removed_at", null)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Místnost D107 nenalezena" }, { status: 404 });
    }

    // Get schedule breaks for a wide range (past and future) using admin client
    const now = new Date();
    const sixMonthsAgo = addMonths(now, -6);
    const sixMonthsLater = addMonths(now, 6);
    const { data: scheduleBreaks } = await adminClient
      .from("schedule_breaks")
      .select("start_date, end_date")
      .lte("start_date", sixMonthsLater.toISOString().split("T")[0])
      .gte("end_date", sixMonthsAgo.toISOString().split("T")[0]);

    const breaks = scheduleBreaks || [];

    // Generate HC for past 3 months, current month, and next 6 months
    // This ensures historical data and future planning are covered
    const results = [];
    for (let i = -3; i <= 6; i++) {
      const targetMonth = addMonths(now, i);
      const result = await createHCForMonth(
        adminClient,
        room.id,
        targetMonth,
        breaks,
        actorProfileId
      );
      results.push({
        month: targetMonth.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" }),
        ...result,
        date: result.date.toLocaleDateString("cs-CZ"),
      });
    }

    const created = results.filter((r) => r.created);

    return NextResponse.json({
      success: true,
      created_count: created.length,
      results,
      message:
        created.length > 0
          ? `Vytvořeno ${created.length} Houston Calling`
          : "Všechny Houston Calling již existují nebo jsou v období volna",
    });
  } catch (error) {
    serverLogger.console.error("POST /api/houston-calling/generate error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

/**
 * GET /api/houston-calling/generate
 * Check next Houston Calling date
 */
export async function GET() {
  const now = new Date();
  const nextMonth = addMonths(now, 1);
  const firstDayOfMonth = startOfMonth(nextMonth);
  
  let firstWednesday = firstDayOfMonth;
  while (getDay(firstWednesday) !== 3) {
    firstWednesday = addDays(firstWednesday, 1);
  }

  return NextResponse.json({
    next_houston_calling: firstWednesday.toISOString(),
    next_houston_calling_formatted: firstWednesday.toLocaleDateString("cs-CZ", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  });
}
