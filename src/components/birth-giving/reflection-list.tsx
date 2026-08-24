"use client";

import { MessageSquarePlus } from "lucide-react";

import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import { ProfileAvatar } from "@/components/profile-avatar";
import type {
  BirthGivingEventDetail,
  BirthGivingTeamDetail,
} from "@/lib/birth-giving/types";

interface BirthGivingReflectionListProps {
  event: BirthGivingEventDetail;
  team: BirthGivingTeamDetail;
  profileId: string;
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

export function BirthGivingReflectionList({
  event: _event,
  team,
  profileId: _profileId,
  onEventChange: _onEventChange,
}: BirthGivingReflectionListProps) {
  const membersWithReflection = team.members.filter(
    (member) => member.reflection_contribution || member.reflection_learning,
  );

  return (
    <div className="space-y-2">
      {membersWithReflection.length === 0 && (
        <Empty className="gap-3 p-4 md:p-4">
          <EmptyMedia variant="icon">
            <MessageSquarePlus className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm">Zatím žádné reflexe</EmptyTitle>
            <EmptyDescription className="text-xs">
              Každý člen:ka týmu může přidat svou osobní reflexi.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <ul className="space-y-2">
        {membersWithReflection.map((member) => (
          <li key={member.id} className="space-y-1.5 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <ProfileAvatar picture={member.profile.picture} name={member.profile.name} size={22} />
              <span className="text-sm font-medium">{member.profile.name}</span>
            </div>
            <div className="space-y-1 text-xs pt-1">
              {member.reflection_contribution && (
                <p>
                  <span className="font-medium text-muted-foreground">Přínos: </span>
                  {member.reflection_contribution}
                </p>
              )}
              {member.reflection_learning && (
                <p>
                  <span className="font-medium text-muted-foreground">Poučení: </span>
                  {member.reflection_learning}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}