"use client";

import { useState } from "react";
import { Users, UserRoundCheck, Trophy, PencilLine, FileText, MessageSquareText, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import { ProfileAvatar } from "@/components/profile-avatar";
import { BirthGivingResultFileList } from "./result-file-list";
import { BirthGivingReflectionList } from "./reflection-list";
import { BirthGivingReflectionForm } from "./reflection-form";
import { BirthGivingTeamForm } from "./team-form";
import { isBirthGivingOrganizer, isBirthGivingTeamMember, canManageTeam } from "@/lib/birth-giving/permissions";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import { getEventTimeState } from "@/lib/birth-giving/time";
import { cn } from "@/lib/utils";
import type {
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
  BirthGivingTeamDetail,
} from "@/lib/birth-giving/types";

interface BirthGivingTeamCardProps {
  event: BirthGivingEventDetail;
  team: BirthGivingTeamDetail;
  profileId: string;
  now: string;
  organizerProfiles: BirthGivingProfileSummary[];
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

export function BirthGivingTeamCard({
  event,
  team,
  profileId,
  now,
  organizerProfiles,
  onEventChange,
}: BirthGivingTeamCardProps) {
  const isMine = isBirthGivingTeamMember(team, profileId);
  const isOrganizer = isBirthGivingOrganizer(event, profileId);
  const isCancelled = team.cancelled_at !== null;
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const startsAt = new Date(event.starts_at);
  const timeState = getEventTimeState(startsAt, event.duration, new Date(now));
  const isConcluded = timeState === "ended";

  // After the event ends, team members and details are locked
  const canEditTeam = !isConcluded && canManageTeam(event, team, profileId);

  const myMembership = team.members.find((m) => m.profile_id === profileId);
  const hasMyReflection = Boolean(myMembership?.reflection_contribution || myMembership?.reflection_learning);
  const submittedReflectionsCount = team.members.filter(
    (m) => m.reflection_contribution || m.reflection_learning,
  ).length;

  async function handleToggleWinner() {
    setBusy(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/teams/${team.id}`,
        {
          method: "PATCH",
          body: { isWinner: !team.is_winner },
        },
      );
      if (result.ok) {
        toast.success(team.is_winner ? "Označení vítěze bylo zrušeno" : "Tým byl označen jako vítěz!");
        onEventChange(result.body.data ?? null);
        return;
      }
      toast.error(result.body.error ?? "Nepodařilo se změnit stav vítěze");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className={cn(
        "space-y-4 p-4 sm:p-5 transition-all rounded-2xl border",
        isMine
          ? "border-primary/40 bg-accent/15 shadow-xs"
          : "border-border/50 bg-card/60",
      )}
    >
      {/* Team Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 pb-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Users className="size-4 shrink-0 text-muted-foreground" />
          <h3 className="font-heading text-lg font-bold text-foreground tracking-tight truncate">
            {team.name}
          </h3>

          {team.is_winner && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold text-xs px-2 py-0.5">
              <Trophy className="size-3" />
              Vítězný tým
            </Badge>
          )}

          {isMine && (
            <Badge variant="default" className="gap-1 font-semibold text-xs px-2 py-0.5">
              <UserRoundCheck className="size-3" />
              Můj tým
            </Badge>
          )}

          <Badge variant="outline" className="text-muted-foreground text-xs font-normal">
            {team.members.length} {team.members.length === 1 ? "člen:ka" : "členové:ky"}
          </Badge>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Organizers can always designate or toggle winners */}
          {isOrganizer && (
            <Button
              type="button"
              variant={team.is_winner ? "outline" : "ghost"}
              size="xs"
              className="gap-1 text-xs h-7 text-muted-foreground hover:text-foreground"
              disabled={busy}
              onClick={() => void handleToggleWinner()}
            >
              <Trophy className="size-3" />
              {team.is_winner ? "Zrušit vítězství týmu" : "Označit jako vítězný tým"}
            </Button>
          )}

          {canEditTeam && !isCancelled && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="size-7 p-0 text-muted-foreground hover:text-foreground"
              aria-label={`Upravit tým ${team.name}`}
              onClick={() => setEditOpen(true)}
            >
              <PencilLine className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {isCancelled && team.cancellation_reason && (
        <p className="text-xs text-muted-foreground">{team.cancellation_reason}</p>
      )}

      {!isCancelled && (
        <div className="space-y-4 text-xs">
          {/* Members */}
          <div className="flex flex-wrap items-center gap-1.5">
            {team.members.map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 py-0.5 pl-1 pr-2.5 text-xs font-medium text-foreground"
              >
                <ProfileAvatar picture={member.profile.picture} name={member.profile.name} size={18} />
                <span>{member.profile.name}</span>
              </span>
            ))}
          </div>

          {/* Results: locked for new uploads/deletes after event ends */}
          <div className="space-y-2 pt-2 border-t border-border/20">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <FileText className="size-3.5" />
              <span>Odevzdané výstupy</span>
            </div>
            <BirthGivingResultFileList
              event={event}
              team={team}
              profileId={profileId}
              now={now}
              disabled={isConcluded}
              onEventChange={onEventChange}
            />
          </div>

          {/* Reflections: Shown after the event concludes or when reflections exist */}
          {(isConcluded || submittedReflectionsCount > 0) && (
            <div className="space-y-2.5 pt-2 border-t border-border/20">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <MessageSquareText className="size-3.5" />
                  <span>Reflexe týmu</span>
                </div>
                {isMine && hasMyReflection && (
                  <BirthGivingReflectionForm
                    eventId={event.id}
                    currentContribution={myMembership?.reflection_contribution ?? ""}
                    currentLearning={myMembership?.reflection_learning ?? ""}
                    onEventChange={onEventChange}
                  />
                )}
              </div>

              {/* Prominent, inviting reflection card if user hasn't written their reflection yet */}
              {isConcluded && isMine && !hasMyReflection && (
                <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-3.5 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Sparkles className="size-4 text-amber-500 shrink-0" />
                        Napiš svou reflexi z akce
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Zhodnoť svůj přínos týmu a co ses během akce naučil:a.
                      </p>
                    </div>
                    <BirthGivingReflectionForm
                      eventId={event.id}
                      currentContribution={myMembership?.reflection_contribution ?? ""}
                      currentLearning={myMembership?.reflection_learning ?? ""}
                      onEventChange={onEventChange}
                      trigger={
                        <Button size="sm" className="gap-1.5 font-semibold text-xs h-8 px-3 shrink-0 shadow-xs">
                          <PencilLine className="size-3.5" />
                          Napsat reflexi
                        </Button>
                      }
                    />
                  </div>
                </div>
              )}

              <BirthGivingReflectionList
                event={event}
                team={team}
                profileId={profileId}
                onEventChange={onEventChange}
              />
            </div>
          )}
        </div>
      )}

      {/* Edit Team Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upravit tým</DialogTitle>
            <DialogDescription>
              Upravte název týmu nebo přidejte a odeberte členy:ky.
            </DialogDescription>
          </DialogHeader>
          <BirthGivingTeamForm
            eventId={event.id}
            callerProfileId={profileId}
            availableProfiles={organizerProfiles}
            team={team}
            onSuccess={(updated) => {
              setEditOpen(false);
              onEventChange(updated);
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}