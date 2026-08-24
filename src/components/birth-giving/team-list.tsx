"use client";

import { useMemo, useState } from "react";
import { Plus, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from "@/components/ui/empty";
import { BirthGivingDetailSection } from "./detail-section";
import { BirthGivingTeamCard } from "./team-card";
import { BirthGivingTeamForm } from "./team-form";
import { isBirthGivingTeamMember } from "@/lib/birth-giving/permissions";
import { getEventTimeState } from "@/lib/birth-giving/time";
import type {
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
} from "@/lib/birth-giving/types";

interface BirthGivingTeamListProps {
  event: BirthGivingEventDetail;
  profileId: string;
  now: string;
  organizerProfiles: BirthGivingProfileSummary[];
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

export function BirthGivingTeamList({
  event,
  profileId,
  now,
  organizerProfiles,
  onEventChange,
}: BirthGivingTeamListProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const visibleTeams = event.teams;

  const startsAt = new Date(event.starts_at);
  const timeState = getEventTimeState(startsAt, event.duration, new Date(now));
  const isConcluded = timeState === "ended";

  const emptyDescription = event.status === "draft"
    ? "Týmy se zobrazí po zveřejnění."
    : "Pro tuto událost nebyly založeny žádné týmy.";

  // Sort so that the current user's team appears first, followed by others
  const sortedTeams = useMemo(() => {
    return [...visibleTeams].sort((a, b) => {
      const aIsMine = isBirthGivingTeamMember(a, profileId);
      const bIsMine = isBirthGivingTeamMember(b, profileId);
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      if (a.is_winner && !b.is_winner) return -1;
      if (!a.is_winner && b.is_winner) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [visibleTeams, profileId]);

  return (
    <BirthGivingDetailSection
      title="Týmy"
      icon={UsersRound}
      boxed={false}
      action={
        !isConcluded ? (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" />
                Vytvořit tým
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nový tým</DialogTitle>
                <DialogDescription>
                  Založte tým a vyberte jeho členy:ky.
                </DialogDescription>
              </DialogHeader>
              <BirthGivingTeamForm
                eventId={event.id}
                callerProfileId={profileId}
                availableProfiles={organizerProfiles}
                onSuccess={(updated) => {
                  setCreateOpen(false);
                  onEventChange(updated);
                }}
                onCancel={() => setCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        ) : undefined
      }
    >
      {visibleTeams.length === 0 ? (
        <Empty className="gap-3 border-dashed p-6">
          <EmptyMedia variant="icon">
            <UsersRound className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm">Zatím žádné týmy</EmptyTitle>
            <EmptyDescription className="text-xs">
              {emptyDescription}
            </EmptyDescription>
          </EmptyHeader>
          {!isConcluded && (
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Založit první tým
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sortedTeams.map((team) => (
            <BirthGivingTeamCard
              key={team.id}
              event={event}
              team={team}
              profileId={profileId}
              now={now}
              organizerProfiles={organizerProfiles}
              onEventChange={onEventChange}
            />
          ))}
        </div>
      )}
    </BirthGivingDetailSection>
  );
}