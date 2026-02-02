import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrainingSessionsManager } from "@/components/reservations/training-sessions-manager";
import { ScheduleBreaksManager } from "@/components/reservations/schedule-breaks-manager";
import { IssuesManager } from "@/components/reservations/issues-manager";
import type { Room, RecurringSchedule, ScheduleBreak, RoomIssue } from "@/lib/reservations/types";

export const metadata = {
  title: "Nastavení rezervací | Tappka",
  description: "Správa Training Sessions a výjimek z rozvrhu",
};

/**
 * Coach dashboard for managing Training Sessions and schedule breaks
 * Only accessible by coaches and admins
 */
export default async function ReservationSettingsPage() {
  const supabase = await createClient();

  // Check if user is coach or admin
  const profile = await getCurrentUserProfile(supabase)

  if (profile?.role !== "coach" && profile?.role !== "admin") {
    redirect("reservations");
  }

  const isAdmin = profile?.role === "admin";

  // Fetch all data
  const [roomsResult, schedulesResult, breaksResult, teamsResult, issuesResult] = await Promise.all([
    // Rooms that can have TS
    supabase
      .from("rooms")
      .select("*")
      .eq("can_have_ts", true)
      .order("code"),

    // Recurring schedules with team info
    supabase
      .from("recurring_schedules")
      .select(`
        *,
        room:rooms(id, code, name),
        team:teams(id, name)
      `)
      .gte("valid_until", new Date().toISOString().split("T")[0])
      .order("day_of_week"),

    // Schedule breaks
    supabase
      .from("schedule_breaks")
      .select("*")
      .gte("end_date", new Date().toISOString().split("T")[0])
      .order("start_date"),

    // Teams for TS assignment
    supabase
      .from("teams")
      .select("id, name, year")
      .eq("is_active", true)
      .order("year")
      .order("name"),

    // Room issues
    supabase
      .from("room_issues")
      .select(`
        *,
        room:rooms(id, code, name),
        reporter:profiles!reported_by(id, name),
        resolver:profiles!resolved_by(id, name)
      `)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const rooms = (roomsResult.data || []) as Room[];
  const schedules = (schedulesResult.data || []) as (RecurringSchedule & { room: Room; team: { id: string; name: string } })[];
  const breaks = (breaksResult.data || []) as ScheduleBreak[];
  const teams = teamsResult.data || [];
  const issues = (issuesResult.data || []) as (RoomIssue & {
    room?: { id: string; code: string; name: string };
    reporter?: { id: string; name: string };
    resolver?: { id: string; name: string };
  })[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-heading font-bold">Nastavení rezervací</h2>
        <p className="text-muted-foreground mt-1">
          Správa Training Sessions, Days of Joy a dalších výjimek
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="training-sessions" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-full md:w-auto">
            <TabsTrigger value="training-sessions" className="flex-1 md:flex-initial text-xs sm:text-sm">
              Training Sessions
            </TabsTrigger>
            <TabsTrigger value="schedule-breaks" className="flex-1 md:flex-initial text-xs sm:text-sm">
              Volno a výjimky
            </TabsTrigger>
            <TabsTrigger value="issues" className="flex-1 md:flex-initial text-xs sm:text-sm">
              Problémy
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Training Sessions Tab */}
        <TabsContent value="training-sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Training Sessions</CardTitle>
              <CardDescription>
                Opakované rezervace pro týmy. TS blokují místnost pro ostatní uživatele.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrainingSessionsManager
                rooms={rooms}
                schedules={schedules}
                teams={teams}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Breaks Tab */}
        <TabsContent value="schedule-breaks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Volno a výjimky</CardTitle>
              <CardDescription>
                Days of Joy, prázdniny a další období kdy se TS nekonají.
                Během těchto období jsou místnosti volné pro běžné rezervace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScheduleBreaksManager breaks={breaks} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-4">
          <IssuesManager issues={issues} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
