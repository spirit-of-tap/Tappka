"use client";

import { useState } from "react";
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
} from "@/components/ui/empty";
import { BirthGivingDetailSection } from "./detail-section";
import { BirthGivingTeamCard } from "./team-card";
import { BirthGivingTeamForm } from "./team-form";
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
  const emptyDescription = event.status === "draft"
    ? "Týmy se zobrazí po zveřejnění."
    : "Pro tuto událost nebyly založeny žádné týmy.";

  return (
    <BirthGivingDetailSection
      title="Týmy"
      icon={UsersRound}
      boxed={false}
      action={
        (
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
        )
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
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleTeams.map((team) => (
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