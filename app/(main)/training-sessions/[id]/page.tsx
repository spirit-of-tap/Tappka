import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { redirect, notFound } from "next/navigation";
import { format, parseISO, isPast } from "date-fns";
import { cs } from "date-fns/locale";
import { 
  ArrowLeft, 
  Clock, 
  UserPlus, 
  Calendar,
  Building2,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { CrossParticipantActions } from "./cross-participant-actions";
import { PrepFileSection } from "./prep-file-section";

// Helper to get initials from name
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Helper to get storage URL for picture
function getPictureUrl(picture: string | null | undefined): string | undefined {
  if (!picture) return undefined;
  if (picture.startsWith("http")) return picture;
  return `${process.env.NEXT_PUBLIC_B2_PUBLIC_URL}/profile-pictures/${picture}`;
}

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

  const startTime = session.reservation?.start_time ? parseISO(session.reservation.start_time) : null;
  const endTime = session.reservation?.end_time ? parseISO(session.reservation.end_time) : null;
  const isSessionPast = endTime ? isPast(endTime) : false;
  const isMyTeam = profile.team_id === session.team_id;
  const crossCount = session.cross_participants?.length || 0;
  const availableSlots = session.cross_slots_available - crossCount;
  const isJoined = session.cross_participants?.some(
    (p: any) => p.user_id === profile.id
  );
  const canJoin = !isMyTeam && !isSessionPast && session.cross_slots_available > 0;
  
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

      {/* Main Header */}
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            {/* Team label */}
            {session.team && (
              <div className="flex items-center gap-2">
                <div 
                  className="size-3 rounded-full" 
                  style={{ backgroundColor: session.team.color || '#888' }}
                />
                <span className="text-sm text-muted-foreground">
                  {session.team.name} · Training Session
                </span>
              </div>
            )}
            
            {/* Topic - H1 style from brand manual */}
            <h1 className="text-3xl font-heading font-bold tracking-tight">
              {session.topic}
            </h1>
          </div>

          {/* Action button for non-team members */}
          {canJoin && (
            <CrossParticipantActions
              sessionId={session.id}
              isJoined={isJoined}
              availableSlots={availableSlots}
            />
          )}
        </div>

        {/* Info row - compact inline display */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {startTime && (
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <span>
                {format(startTime, "EEEE d. MMMM yyyy", { locale: cs })}
              </span>
            </div>
          )}
          {startTime && endTime && (
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span>
                {format(startTime, "HH:mm")} – {format(endTime, "HH:mm")}
              </span>
            </div>
          )}
          {room && (
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <span>{room.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Preparation materials section - elevated as second most important */}
      <PrepFileSection
        sessionId={session.id}
        prepFileName={session.prep_file_name}
        isFacilitator={isFacilitator}
      />

      {/* People sections - simplified without excessive borders */}
      <div className="grid gap-8 md:grid-cols-2 pt-4">
        {/* Facilitators */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Facilitátoři</h2>
          </div>
          
          {session.facilitators && session.facilitators.length > 0 ? (
            <div className="space-y-2">
              {session.facilitators.map((f: any) =>
                f.user ? (
                  <div 
                    key={f.id} 
                    className="flex items-center gap-3 py-2"
                  >
                    <Avatar className="size-9">
                      <AvatarImage src={getPictureUrl(f.user.picture)} alt={f.user.name} />
                      <AvatarFallback className="text-xs">{getInitials(f.user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{f.user.name}</span>
                  </div>
                ) : null
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Žádní facilitátoři
            </p>
          )}
        </section>

        {/* Cross participants */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Cross účastníci</h2>
            </div>
            {session.cross_slots_available > 0 && (
              <span className="text-xs text-muted-foreground">
                {crossCount}/{session.cross_slots_available}
              </span>
            )}
          </div>
          
          {session.cross_participants && session.cross_participants.length > 0 ? (
            <div className="space-y-2">
              {session.cross_participants.map((p: any) =>
                p.user ? (
                  <div 
                    key={p.id} 
                    className="flex items-center gap-3 py-2"
                  >
                    <Avatar className="size-9">
                      <AvatarImage src={getPictureUrl(p.user.picture)} alt={p.user.name} />
                      <AvatarFallback className="text-xs">{getInitials(p.user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{p.user.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {p.user.team && (
                          <span className="flex items-center gap-1">
                            <span 
                              className="size-2 rounded-full" 
                              style={{ backgroundColor: p.user.team.color || '#888' }}
                            />
                            {p.user.team.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              {session.cross_slots_available > 0
                ? `${session.cross_slots_available} míst k dispozici`
                : "Cross účast není povolena"}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
