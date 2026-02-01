import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { Reservation, RoomIssue, Room } from "@/lib/reservations/types";

interface RouteParams {
  params: Promise<{ code: string }>;
}

interface QuickStatusResponse {
  room: {
    id: string;
    code: string;
    name: string;
    description: string | null;
  };
  status: 'free' | 'occupied' | 'locked';
  currentReservation?: {
    title: string;
    occupantName: string;
    personCount: number | null;
    startTime: string;
    endTime: string;
    endsInMinutes: number;
  };
  nextAvailable?: string;
  issues: {
    isLocked: boolean;
    otherIssues: string[];
  };
  alternativeRooms?: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

/**
 * GET /api/rooms/[code]/quick-status
 * Get quick status info for QR code scans
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    // Fetch room by code
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code.toLowerCase())
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: "Místnost nenalezena" },
        { status: 404 }
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Fetch current reservation
    const { data: currentReservation } = await supabase
      .from("reservations")
      .select(`
        *,
        user:profiles(id, full_name),
        team:teams(id, name)
      `)
      .eq("room_id", room.id)
      .eq("status", "active")
      .lte("start_time", nowIso)
      .gt("end_time", nowIso)
      .single();

    // Fetch open issues
    const { data: issues } = await supabase
      .from("room_issues")
      .select("*")
      .eq("room_id", room.id)
      .eq("status", "open");

    const roomIssues = (issues || []) as RoomIssue[];
    const isLocked = roomIssues.some((i) => i.issue_type === "locked");
    const otherIssues = roomIssues
      .filter((i) => i.issue_type !== "locked")
      .map((i) => {
        const labels: Record<string, string> = {
          mess: "Nepořádek",
          technical: "Technický problém",
          other: "Jiné",
        };
        return labels[i.issue_type] || i.issue_type;
      });

    // Determine status
    let status: 'free' | 'occupied' | 'locked' = 'free';
    if (isLocked) {
      status = 'locked';
    } else if (currentReservation) {
      status = 'occupied';
    }

    const response: QuickStatusResponse = {
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        description: room.description,
      },
      status,
      issues: {
        isLocked,
        otherIssues,
      },
    };

    // Add current reservation details if occupied
    if (currentReservation) {
      const endTime = new Date(currentReservation.end_time);
      const endsInMinutes = Math.round((endTime.getTime() - now.getTime()) / (1000 * 60));

      const occupantName = currentReservation.user?.full_name ||
        currentReservation.team?.name ||
        "Neznámý";

      response.currentReservation = {
        title: currentReservation.title,
        occupantName,
        personCount: currentReservation.person_count,
        startTime: currentReservation.start_time,
        endTime: currentReservation.end_time,
        endsInMinutes,
      };

      // Fetch alternative rooms that are currently free
      const { data: allRooms } = await supabase
        .from("rooms")
        .select("*")
        .neq("id", room.id)
        .order("code");

      if (allRooms && allRooms.length > 0) {
        // Check which rooms are free
        const { data: otherCurrentReservations } = await supabase
          .from("reservations")
          .select("room_id")
          .eq("status", "active")
          .lte("start_time", nowIso)
          .gt("end_time", nowIso);

        const occupiedRoomIds = new Set(
          (otherCurrentReservations || []).map((r) => r.room_id)
        );

        const freeRooms = allRooms.filter((r) => !occupiedRoomIds.has(r.id));

        // Sort by relevance (same logic as main room page)
        const sortedFreeRooms = sortAlternativeRooms(freeRooms, room);

        // Take top 3
        response.alternativeRooms = sortedFreeRooms.slice(0, 3).map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
        }));
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/rooms/[code]/quick-status error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}

/**
 * Sort alternative rooms based on current room type
 * (Same logic as in /app/dashboard/reservations/[code]/page.tsx)
 */
function sortAlternativeRooms(rooms: Room[], currentRoom: Room): Room[] {
  const tsRoomCodes = ["d126", "d132", "d226"];
  const quietRepreCodes = ["d127", "d129"];
  const d107Code = "d107";

  const getPriority = (roomCode: string): number => {
    if (tsRoomCodes.includes(currentRoom.code)) {
      if (tsRoomCodes.includes(roomCode)) return 1;
      if (quietRepreCodes.includes(roomCode)) return 2;
      if (roomCode === d107Code) return 3;
      return 4;
    } else if (quietRepreCodes.includes(currentRoom.code)) {
      if (quietRepreCodes.includes(roomCode)) return 1;
      if (tsRoomCodes.includes(roomCode)) return 2;
      if (roomCode === d107Code) return 3;
      return 4;
    } else if (currentRoom.code === d107Code) {
      if (tsRoomCodes.includes(roomCode)) return 1;
      if (quietRepreCodes.includes(roomCode)) return 2;
      return 3;
    }
    return 99;
  };

  return [...rooms].sort((a, b) => getPriority(a.code) - getPriority(b.code));
}
