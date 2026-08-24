"use client";

import { useState } from "react";
import { Users, UserRoundCheck, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { BirthGivingResultFileList } from "./result-file-list";
import { BirthGivingReflectionList } from "./reflection-list";
import { BirthGivingReflectionForm } from "./reflection-form";
import { isBirthGivingOrganizer, isBirthGivingTeamMember } from "@/lib/birth-giving/permissions";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
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

const SUBSECTION_LABEL_CLASS =
  "flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase";

export function BirthGivingTeamCard({
  event,
  team,
  profileId,
  now,
  organizerProfiles: _organizerProfiles,
  onEventChange,
}: BirthGivingTeamCardProps) {
  const isMine = isBirthGivingTeamMember(team, profileId);
  const isOrganizer = isBirthGivingOrganizer(event, profileId);
  const isCancelled = team.cancelled_at !== null;
  const [busy, setBusy] = useState(false);

  const myMembership = team.members.find((m) => m.profile_id === profileId);

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
    <Card className="space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Users className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-semibold text-base">{team.name}</span>
        {team.is_winner && (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
            <Trophy className="size-3" />
            Vítězný tým
          </Badge>
        )}
        {isMine && (
          <Badge variant="default" className="gap-1">
            <UserRoundCheck className="size-3" />
            Můj tým
          </Badge>
        )}
        <Badge variant="outline" className="ml-auto text-muted-foreground">
          {team.members.length} {team.members.length === 1 ? "člen:ka" : "členové:ky"}
        </Badge>
      </div>

      {isCancelled && team.cancellation_reason && (
        <p className="text-xs text-muted-foreground">{team.cancellation_reason}</p>
      )}

      {!isCancelled && (
        <div className="divide-y divide-border">
          {/* Members */}
          <div className="space-y-1.5 pb-3">
            <p className={SUBSECTION_LABEL_CLASS}>Členové:ky týmu</p>
            <ul className="space-y-1.5">
              {team.members.map((member) => (
                <li key={member.id} className="flex items-center gap-2 text-sm">
                  <ProfileAvatar picture={member.profile.picture} name={member.profile.name} size={24} />
                  <span className="min-w-0 flex-1 truncate">{member.profile.name}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Results */}
          <div className="space-y-2 py-3">
            <p className={SUBSECTION_LABEL_CLASS}>Výsledky a odevzdané soubory</p>
            <BirthGivingResultFileList
              event={event}
              team={team}
              profileId={profileId}
              now={now}
              onEventChange={onEventChange}
            />
          </div>

          {/* Reflections */}
          <div className="space-y-2 pt-3">
            <div className="flex items-center justify-between">
              <p className={SUBSECTION_LABEL_CLASS}>Reflexe účastníků:ic</p>
              {isMine && (
                <BirthGivingReflectionForm
                  eventId={event.id}
                  currentContribution={myMembership?.reflection_contribution ?? ""}
                  currentLearning={myMembership?.reflection_learning ?? ""}
                  onEventChange={onEventChange}
                />
              )}
            </div>
            <BirthGivingReflectionList
              event={event}
              team={team}
              profileId={profileId}
              onEventChange={onEventChange}
            />
          </div>

          {/* Organizer actions: Designate winner */}
          {isOrganizer && (
            <div className="pt-3 flex justify-end">
              <Button
                type="button"
                variant={team.is_winner ? "outline" : "default"}
                size="sm"
                className="gap-1.5"
                disabled={busy}
                onClick={() => void handleToggleWinner()}
              >
                <Trophy className="size-4" />
                {team.is_winner ? "Zrušit vítězství týmu" : "Označit jako vítězný tým"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}