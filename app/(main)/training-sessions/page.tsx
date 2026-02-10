import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrainingSessionsList } from "@/components/reservations/training-sessions-list";
import type { Room, TrainingSessionWithDetails } from "@/lib/reservations/types";

export const metadata = {
  title: "Training Sessions | Tappka",
  description: "Vytvoř a spravuj Training Sessions pro svůj tým",
};

/**
 * Training Sessions page - available to all users
 * Users can create/manage training sessions for their own team
 */
export default async function TrainingSessionsPage() {
  const supabase = await createClient();

  const profile = await getCurrentUserProfile(supabase);

  if (!profile) {
    redirect("/auth/login");
  }

  // Fetch all data
  const [roomsResult, trainingSessionsResult, teamsResult, usersResult] = await Promise.all([
    // Rooms
    supabase.from("rooms").select("*").order("code"),

    // Training sessions with details (including past sessions for display)
    supabase
      .from("training_sessions")
      .select(`
        *,
        reservation:reservations(*),
        team:teams(id, name, year, color),
        facilitators:training_session_facilitators(
          id,
          user_id,
          user:profiles(id, name, picture)
        ),
        cross_participants:training_session_cross_participants(
          id,
          user_id,
          joined_at,
          user:profiles(id, name, picture)
        )
      `)
      .order("created_at", { ascending: false }),

    // Teams
    supabase.from("teams").select("id, name, year, color").order("year").order("name"),

    // All users for facilitator selection (with pictures for avatars)
    supabase.from("profiles").select("id, name, picture").order("name"),
  ]);

  const rooms = (roomsResult.data || []) as Room[];
  const trainingSessions = (trainingSessionsResult.data || []) as TrainingSessionWithDetails[];
  const teams = teamsResult.data || [];
  const users = usersResult.data || [];

  return (
    <div className="space-y-6">
      {/* Header is now inside TrainingSessionsList for button positioning */}

      <TrainingSessionsList
        rooms={rooms}
        sessions={trainingSessions}
        teams={teams}
        users={users}
        currentUserTeamId={profile.team_id}
        currentUserId={profile.id}
      />
    </div>
  );
}
