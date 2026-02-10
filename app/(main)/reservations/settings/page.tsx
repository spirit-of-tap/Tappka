import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HoustonCallingList } from "@/components/reservations/houston-calling-list";
import { ScheduleBreaksManager } from "@/components/reservations/schedule-breaks-manager";
import { IssuesManager } from "@/components/reservations/issues-manager";
import type { Room, HoustonCallingEventWithDetails, ScheduleBreak, RoomIssue } from "@/lib/reservations/types";

export const metadata = {
  title: "Nastavení rezervací | Tappka",
  description: "Správa Houston Calling a výjimek z rozvrhu",
};

/**
 * Settings page for managing Houston Calling and schedule breaks
 * Only accessible by coaches and admins
 */
export default async function ReservationSettingsPage() {
  const supabase = await createClient();

  const profile = await getCurrentUserProfile(supabase);

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    redirect("/reservations");
  }

  // Fetch all data
  const [
    roomsResult,
    houstonCallingResult,
    breaksResult,
    teamsResult,
    issuesResult,
  ] = await Promise.all([
    // Rooms
    supabase
      .from("rooms")
      .select("*")
      .order("code"),

    // Houston Calling events
    supabase
      .from("houston_calling_events")
      .select(`
        *,
        reservation:reservations(*),
        team:teams(id, name, year)
      `)
      .gte("reservation.start_time", new Date().toISOString())
      .order("created_at", { ascending: false }),

    // Schedule breaks
    supabase
      .from("schedule_breaks")
      .select("*")
      .gte("end_date", new Date().toISOString().split("T")[0])
      .order("start_date"),

    // Teams
    supabase
      .from("teams")
      .select("id, name, year")
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
  const houstonCallingEvents = (houstonCallingResult.data || []) as HoustonCallingEventWithDetails[];
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
          Správa Houston Calling a dalších výjimek
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="houston-calling" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-full md:w-auto">
            <TabsTrigger value="houston-calling" className="flex-1 md:flex-initial text-xs sm:text-sm">
              Houston Calling
            </TabsTrigger>
            <TabsTrigger value="schedule-breaks" className="flex-1 md:flex-initial text-xs sm:text-sm">
              Volno a výjimky
            </TabsTrigger>
            <TabsTrigger value="issues" className="flex-1 md:flex-initial text-xs sm:text-sm">
              Problémy
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Houston Calling Tab */}
        <TabsContent value="houston-calling" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Houston Calling</CardTitle>
              <CardDescription>
                Měsíční check-in pro týmy. Každý HC trvá 4 hodiny.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HoustonCallingList
                rooms={rooms}
                events={houstonCallingEvents}
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
                Days of Joy, prázdniny a další období.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScheduleBreaksManager breaks={breaks} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-4">
          <IssuesManager issues={issues} isAdmin={profile.role === "admin"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
