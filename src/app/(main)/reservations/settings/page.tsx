import { CalendarOff, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrainingSessionsManager } from "@/components/reservations/training-sessions-manager";
import { ScheduleBreaksManager } from "@/components/reservations/schedule-breaks-manager";
import { PageHeader } from "@/components/ui/page-header";
import type { Room, RecurringSchedule, ScheduleBreak } from "@/lib/reservations/types";

export const metadata = {
  title: "Nastavení rezervací | Tappka",
  description: "Spravuj Training Sessions a výjimky v rozvrhu",
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

  // Fetch all data
  const today = new Date().toISOString().split("T")[0];
  const [roomsResult, schedulesResult, breaksResult, teamsResult] = await Promise.all([
    // Rooms that can have TS
    supabase
      .from("rooms")
      .select("*")
      .eq("can_have_ts", true)
      .is("removed_at", null)
      .order("code"),

    // Recurring schedules with team info
    supabase
      .from("recurring_schedules")
      .select(`
        *,
        room:rooms(id, code, name),
        team:teams(id, name)
      `)
      .is("removed_at", null)
      .eq("schedule_type", "training_session")
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .order("day_of_week"),

    // Schedule breaks
    supabase
      .from("schedule_breaks")
      .select("*")
      .gte("end_date", today)
      .order("start_date"),

    // Teams for TS assignment
    supabase
      .from("teams")
      .select("id, name, onboardingYear")
      .order("onboardingYear")
      .order("name"),
  ]);

  const rooms = (roomsResult.data || []) as Room[];
  const schedules = (schedulesResult.data || []) as (RecurringSchedule & { room: Room; team: { id: string; name: string } })[];
  const breaks = (breaksResult.data || []) as ScheduleBreak[];
  const teams = teamsResult.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nastavení rezervací"
        description="Spravuj Training Sessions a výjimky v rozvrhu"
        back={{ href: "/reservations", label: "Zpět na rezervace" }}
      />

      {/* Tabs */}
      <Tabs defaultValue="training-sessions" className="space-y-4">
        {/* The wrapper's own overflow handling is gone — TabsList scrolls itself now. */}
        <TabsList>
          <TabsTrigger value="training-sessions">
            <GraduationCap />
            Training Sessions
          </TabsTrigger>
          <TabsTrigger value="schedule-breaks">
            <CalendarOff />
            Volno a výjimky
          </TabsTrigger>
        </TabsList>

        {/* Training Sessions Tab */}
        <TabsContent value="training-sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Training Sessions</CardTitle>
              <CardDescription>
                Opakované rezervace pro týmy. TS blokují místnost pro ostatní.
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
      </Tabs>
    </div>
  );
}
