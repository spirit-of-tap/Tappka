"use client";

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
        <p className="text-xs text-muted-foreground italic py-1">
          Zatím žádné odevzdané reflexe.
        </p>
      )}

      {membersWithReflection.length > 0 && (
        <ul className="divide-y divide-border/30">
          {membersWithReflection.map((member) => (
            <li key={member.id} className="space-y-1.5 py-2 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <ProfileAvatar picture={member.profile.picture} name={member.profile.name} size={18} />
                <span className="font-medium text-xs text-foreground">{member.profile.name}</span>
              </div>
              <div className="space-y-1 pl-6 text-xs leading-relaxed text-muted-foreground">
                {member.reflection_contribution && (
                  <p>
                    <span className="font-medium text-foreground/90">Přínos: </span>
                    <span>{member.reflection_contribution}</span>
                  </p>
                )}
                {member.reflection_learning && (
                  <p>
                    <span className="font-medium text-foreground/90">Poučení: </span>
                    <span>{member.reflection_learning}</span>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}