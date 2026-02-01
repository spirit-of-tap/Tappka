import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Lock, Clock, Users, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/reservations/utils";
import type { Room, Reservation, RoomIssue } from "@/lib/reservations/types";

interface RezervecePageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: RezervecePageProps) {
  const { code } = await params;
  return {
    title: `${code.toUpperCase()} | Rezervace | Tappka`,
    description: "Rezervace místnosti v Tiimiakatemia Prague",
  };
}

/**
 * Public NFC/QR entry point for room reservations
 * - If user is logged in, redirects to dashboard version
 * - If not logged in, shows room status and login prompt
 */
export default async function RezerevacePage({ params }: RezervecePageProps) {
  const { code } = await params;
  const supabase = await createClient();

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();

  // If logged in, redirect to dashboard version
  if (user) {
    redirect(`/dashboard/reservations/${code}`);
  }

  // Fetch room by code
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code.toLowerCase())
    .single();

  if (roomError || !room) {
    notFound();
  }

  // Fetch current reservation and issues
  const now = new Date().toISOString();

  const [currentResResult, issuesResult] = await Promise.all([
    supabase
      .from("reservations")
      .select("*")
      .eq("room_id", room.id)
      .eq("status", "active")
      .lte("start_time", now)
      .gt("end_time", now)
      .single(),

    supabase
      .from("room_issues")
      .select("*")
      .eq("room_id", room.id)
      .eq("status", "open"),
  ]);

  const currentReservation = currentResResult.data as Reservation | null;
  const issues = (issuesResult.data || []) as RoomIssue[];
  const isLocked = issues.some((i) => i.issue_type === "locked");

  // Determine status
  const isOccupied = currentReservation !== null;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Room Status Card */}
        <Card className={`border-2 ${isLocked ? "border-orange-500" : isOccupied ? "border-red-500" : "border-green-500"}`}>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-3xl font-heading">{room.name}</CardTitle>
            {room.description && (
              <p className="text-muted-foreground">{room.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status */}
            <div className="text-center">
              {isLocked ? (
                <Badge variant="secondary" className="text-lg py-2 px-4 bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200">
                  <Lock className="size-5 mr-2" />
                  Zamčená místnost
                </Badge>
              ) : isOccupied ? (
                <Badge variant="destructive" className="text-lg py-2 px-4">
                  <Users className="size-5 mr-2" />
                  Obsazeno
                </Badge>
              ) : (
                <Badge variant="default" className="text-lg py-2 px-4 bg-green-600">
                  Volná
                </Badge>
              )}
            </div>

            {/* Current reservation info */}
            {currentReservation && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-medium">{currentReservation.title}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="size-4" />
                  {formatTime(currentReservation.start_time)} - {formatTime(currentReservation.end_time)}
                </p>
                {currentReservation.person_count && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="size-4" />
                    {currentReservation.person_count} osob
                  </p>
                )}
              </div>
            )}

            {/* Locked warning */}
            {isLocked && (
              <div className="bg-orange-100 dark:bg-orange-950/50 rounded-lg p-4 text-center">
                <p className="text-orange-800 dark:text-orange-200 text-sm">
                  Někdo nahlásil, že se do místnosti nedá dostat.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Login prompt */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Pro rezervaci místnosti se přihlas do aplikace Tappka.
              </p>
              <Button asChild className="w-full" size="lg">
                <Link href={`/?returnUrl=/rezervace/${code}`}>
                  <LogIn className="size-5 mr-2" />
                  Přihlásit se
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Tiimiakatemia Prague • Rezervační systém
        </p>
      </div>
    </main>
  );
}
