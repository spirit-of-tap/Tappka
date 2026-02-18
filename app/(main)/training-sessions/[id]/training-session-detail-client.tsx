"use client";

import { format, parseISO, isPast } from "date-fns";
import { cs } from "date-fns/locale";
import {
  Clock,
  UserPlus,
  Calendar,
  Building2,
  GraduationCap,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { CrossParticipantActions } from "./cross-participant-actions";
import { PrepFileSection } from "./prep-file-section";
import { useTrainingSessionRealtime } from "@/lib/hooks/use-training-session-realtime";
import type { TrainingSessionWithDetails, Room } from "@/lib/reservations/types";

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

interface TrainingSessionDetailClientProps {
  initialSession: TrainingSessionWithDetails;
  room: Room | null;
  currentUserId: string;
  currentUserTeamId: string | null;
  isFacilitator: boolean;
}

export function TrainingSessionDetailClient({
  initialSession,
  room,
  currentUserId,
  currentUserTeamId,
  isFacilitator,
}: TrainingSessionDetailClientProps) {
  const { session } = useTrainingSessionRealtime({
    sessionId: initialSession.id,
    initialSession,
  });

  const startTime = session.reservation?.start_time
    ? parseISO(session.reservation.start_time)
    : null;
  const endTime = session.reservation?.end_time
    ? parseISO(session.reservation.end_time)
    : null;
  const isSessionPast = endTime ? isPast(endTime) : false;
  const isMyTeam = currentUserTeamId === session.team_id;
  const crossCount = session.cross_participants?.length || 0;
  const availableSlots = session.cross_slots_available - crossCount;
  const isJoined = session.cross_participants?.some(
    (p) => p.user_id === currentUserId
  );
  const canJoin = !isMyTeam && !isSessionPast && session.cross_slots_available > 0;

  return (
    <>
      {/* Main Header */}
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            {session.team && (
              <div className="flex items-center gap-2">
                <div
                  className="size-3 rounded-full"
                  style={{ backgroundColor: session.team.color || "#888" }}
                />
                <span className="text-sm text-muted-foreground">
                  {session.team.name} · Training Session
                </span>
              </div>
            )}
            <h1 className="text-3xl font-heading font-bold tracking-tight">
              {session.topic}
            </h1>
          </div>

          {canJoin && (
            <CrossParticipantActions
              sessionId={session.id}
              isJoined={!!isJoined}
              availableSlots={availableSlots}
            />
          )}
        </div>

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

      <PrepFileSection
        sessionId={session.id}
        prepFileName={session.prep_file_name}
        isFacilitator={isFacilitator}
      />

      <div className="grid gap-8 md:grid-cols-2 pt-4">
        {/* Facilitators */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Facilitatoři
            </h2>
          </div>
          {session.facilitators && session.facilitators.length > 0 ? (
            <div className="space-y-2">
              {session.facilitators.map((f) =>
                f.user ? (
                  <div key={f.id} className="flex items-center gap-3 py-2">
                    <Avatar className="size-9">
                      <AvatarImage
                        src={getPictureUrl(f.user.picture)}
                        alt={f.user.name}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(f.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{f.user.name}</span>
                  </div>
                ) : null
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Žádní facilitatoři
            </p>
          )}
        </section>

        {/* Cross participants */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Cross účastníci
              </h2>
            </div>
            {session.cross_slots_available > 0 && (
              <span className="text-xs text-muted-foreground">
                {crossCount}/{session.cross_slots_available}
              </span>
            )}
          </div>

          {session.cross_participants && session.cross_participants.length > 0 ? (
            <div className="space-y-2">
              {session.cross_participants.map((p) =>
                p.user ? (
                  <div key={p.id} className="flex items-center gap-3 py-2">
                    <Avatar className="size-9">
                      <AvatarImage
                        src={getPictureUrl(p.user.picture)}
                        alt={p.user.name}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(p.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{p.user.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {(p.user as any).team && (
                          <span className="flex items-center gap-1">
                            <span
                              className="size-2 rounded-full"
                              style={{
                                backgroundColor:
                                  (p.user as any).team.color || "#888",
                              }}
                            />
                            {(p.user as any).team.name}
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
    </>
  );
}
