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

    // Training sessions with details
    supabase
      .from("training_sessions")
      .select(`
        *,
        reservation:reservations(*),
        team:teams(id, name, year),
        facilitators:training_session_facilitators(
          id,
          user_id,
          user:profiles(id, name)
        ),
        cross_participants:training_session_cross_participants(
          id,
          user_id,
          joined_at,
          user:profiles(id, name)
        )
      `)
      .gte("reservation.start_time", new Date().toISOString())
      .order("created_at", { ascending: false }),

    // Teams
    supabase.from("teams").select("id, name, year").order("year").order("name"),

    // All users for facilitator selection
    supabase.from("profiles").select("id, name").order("name"),
  ]);

  const rooms = (roomsResult.data || []) as Room[];
  const trainingSessions = (trainingSessionsResult.data || []) as TrainingSessionWithDetails[];
  const teams = teamsResult.data || [];
  const users = usersResult.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-heading font-bold">Training Sessions</h2>
        <p className="text-muted-foreground mt-1">
          Vytvoř a spravuj Training Sessions pro svůj tým. Každý TS trvá 4 hodiny.
        </p>
      </div>

      <TrainingSessionsList
        rooms={rooms}
        sessions={trainingSessions}
        teams={teams}
        users={users}
        currentUserTeamId={profile.team_id}
      />
    </div>
  );
}
