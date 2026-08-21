"use client";

import { Users, UserRoundCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileAvatar } from "@/components/profile-avatar";
import { BirthGivingProposalActions } from "./proposal-actions";
import { BirthGivingResultFileList } from "./result-file-list";
import { BirthGivingReflectionList } from "./reflection-list";
import { BirthGivingTeamReadinessBadge } from "./team-readiness-badge";
import { isBirthGivingTeamMember } from "@/lib/birth-giving/permissions";
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

const STATUS_LABELS = {
  forming: "Sestavuje se",
  confirmed: "Potvrzený",
  cancelled: "Zrušený",
} as const;

const SUBSECTION_LABEL_CLASS =
  "flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase";

export function BirthGivingTeamCard({
  event,
  team,
  profileId,
  now,
  organizerProfiles,
  onEventChange,
}: BirthGivingTeamCardProps) {
  const isMine = isBirthGivingTeamMember(team, profileId);
  const isCancelled = team.status === "cancelled";

  return (
    <Card className="space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Users className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium">{team.name}</span>
        <Badge
          variant={isCancelled ? "outline" : "secondary"}
          className={isCancelled ? "text-muted-foreground" : undefined}
        >
          {STATUS_LABELS[team.status]}
        </Badge>
        {isMine && (
          <Badge variant="default" className="gap-1">
            <UserRoundCheck className="size-3" />
            Můj tým
          </Badge>
        )}
        <Badge variant="outline" className="ml-auto text-muted-foreground">
          {team.members.length}/{event.maximum_team_size}
        </Badge>
      </div>

      {isCancelled && team.cancellation_reason && (
        <p className="text-xs text-muted-foreground">{team.cancellation_reason}</p>
      )}

      {!isCancelled && (
        <>
          <BirthGivingTeamReadinessBadge team={team} />

          <div className="divide-y divide-border">
            <div className="space-y-1.5 pb-3">
              <p className={SUBSECTION_LABEL_CLASS}>Členové</p>
              <ul className="space-y-1.5">
                {team.members.map((member) => (
                  <li key={member.id} className="flex items-center gap-2 text-sm">
                    <ProfileAvatar picture={member.profile.picture} name={member.profile.name} size={24} />
                    <span className="min-w-0 flex-1 truncate">{member.profile.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 py-3">
              <p className={SUBSECTION_LABEL_CLASS}>
                Žádosti a pozvánky
                {team.proposals.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium normal-case tracking-normal">
                    {team.proposals.length}
                  </Badge>
                )}
              </p>
              <BirthGivingProposalActions
                event={event}
                team={team}
                profileId={profileId}
                profiles={organizerProfiles}
                now={now}
                onEventChange={onEventChange}
              />
            </div>

            <div className="space-y-2 py-3">
              <p className={SUBSECTION_LABEL_CLASS}>Výsledky</p>
              <BirthGivingResultFileList
                event={event}
                team={team}
                profileId={profileId}
                now={now}
                onEventChange={onEventChange}
              />
            </div>

            <div className="space-y-2 pt-3">
              <p className={SUBSECTION_LABEL_CLASS}>Reflexe</p>
              <BirthGivingReflectionList
                event={event}
                team={team}
                profileId={profileId}
                onEventChange={onEventChange}
              />
            </div>
          </div>
        </>
      )}
    </Card>
  );
}