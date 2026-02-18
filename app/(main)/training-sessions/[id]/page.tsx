import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { redirect, notFound } from "next/navigation";
import { parseISO, isPast } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrainingSessionDetailClient } from "./training-session-detail-client";
import type { TrainingSessionWithDetails, Room } from "@/lib/reservations/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: session } = await supabase
    .from("training_sessions")
    .select("topic, team:teams(name)")
    .eq("id", id)
    .single();

  if (!session) {
    return { title: "Training Session | Tappka" };
  }

  return {
    title: `${session.topic} | Training Session | Tappka`,
    description: `Training Session: ${session.topic}`,
  };
}

export default async function TrainingSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const profile = await getCurrentUserProfile(supabase);

  if (!profile) {
    redirect("/auth/login");
  }

  // Fetch training session with all details
  const { data: session, error } = await supabase
    .from("training_sessions")
    .select(`
      *,
      prep_file_key,
      prep_file_name,
      reservation:reservations(*),
      team:teams(id, name, year, color),
      facilitators:training_session_facilitators(
        id,
        user_id,
        user:profiles(id, name, picture, team_id)
      ),
      cross_participants:training_session_cross_participants(
        id,
        user_id,
        joined_at,
        user:profiles(id, name, picture, team_id, team:teams(id, name, color))
      )
    `)
    .eq("id", id)
    .single();

  if (error || !session) {
    notFound();
  }

  // Fetch room details
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", session.reservation?.room_id)
    .single();

  const endTime = session.reservation?.end_time ? parseISO(session.reservation.end_time) : null;
  const isSessionPast = endTime ? isPast(endTime) : false;
  
  // Check if current user is a facilitator of this session
  const isFacilitator = session.facilitators?.some(
    (f: any) => f.user_id === profile.id
  ) || false;

  return (
    <div className="max-w-4xl space-y-8">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/training-sessions">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2">
            <ArrowLeft className="size-4" />
            Zpět na seznam
          </Button>
        </Link>

        {isSessionPast && (
          <Badge variant="secondary" className="text-muted-foreground">
            Proběhlo
          </Badge>
        )}
      </div>

      <TrainingSessionDetailClient
        initialSession={session as unknown as TrainingSessionWithDetails}
        room={room as Room | null}
        currentUserId={profile.id}
        currentUserTeamId={profile.team_id}
        isFacilitator={isFacilitator}
      />
    </div>
  );
}
