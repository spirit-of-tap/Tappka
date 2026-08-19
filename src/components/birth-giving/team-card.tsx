"use client";

import { Users, ShieldCheck, UserRoundCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileAvatar } from "@/components/profile-avatar";
import { BirthGivingProposalActions } from "./proposal-actions";
import { BirthGivingResultFileList } from "./result-file-list";
import { BirthGivingReflectionList } from "./reflection-list";
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
          <ul className="space-y-1.5">
            {team.members.map((member) => (
              <li key={member.id} className="flex items-center gap-2 text-sm">
                <ProfileAvatar picture={member.profile.picture} name={member.profile.name} size={24} />
                <span className="min-w-0 flex-1 truncate">{member.profile.name}</span>
                <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ul>

          <BirthGivingProposalActions
            event={event}
            team={team}
            profileId={profileId}
            profiles={organizerProfiles}
            now={now}
            onEventChange={onEventChange}
          />

          <BirthGivingResultFileList
            event={event}
            team={team}
            profileId={profileId}
            now={now}
            onEventChange={onEventChange}
          />

          <BirthGivingReflectionList
            event={event}
            team={team}
            profileId={profileId}
            onEventChange={onEventChange}
          />
        </>
      )}
    </Card>
  );
}