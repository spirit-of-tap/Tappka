"use client";

import { useState } from "react";
import { Loader2, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyMedia,
} from "@/components/ui/empty";
import { ProfileAvatar } from "@/components/profile-avatar";
import { BirthGivingDetailSection } from "./detail-section";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import { canFormBirthGivingTeams, getBirthGivingMembership } from "@/lib/birth-giving/permissions";
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

interface BirthGivingLookingForTeamListProps {
  event: BirthGivingEventDetail;
  profileId: string;
  now: string;
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

export function BirthGivingLookingForTeamList({
  event,
  profileId,
  now,
  onEventChange,
}: BirthGivingLookingForTeamListProps) {
  const [busy, setBusy] = useState(false);
  const searches = event.team_searches;
  const clientNow = new Date(now);
  const formationOpen = canFormBirthGivingTeams(event, clientNow);
  const myTeamId = getBirthGivingMembership(event, profileId)?.team_id ?? null;
  const iAmLooking = searches.some((search) => search.profile_id === profileId);

  async function setLooking(looking: boolean) {
    setBusy(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/looking-for-team`,
        looking ? { method: "PUT", body: { looking: true } } : { method: "DELETE" },
      );
      if (result.ok && result.body.data) {
        toast.success(looking ? "Hledání týmu zapnuto" : "Hledání týmu vypnuto");
        onEventChange(result.body.data);
        return;
      }
      toast.error(result.body.error ?? "Hledání týmu se nepodařilo změnit");
      onEventChange(result.body.data ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BirthGivingDetailSection
      title="Hledají tým"
      badge={
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {searches.length}
        </Badge>
      }
    >
      {searches.length === 0 ? (
        <Empty className="gap-3 border-dashed p-4">
          <EmptyMedia variant="icon">
            <UsersRound className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm">Nikdo zatím nehledá tým.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="space-y-1.5">
          {searches.map((search) => (
            <li key={search.profile_id} className="flex items-center gap-2 text-sm">
              <ProfileAvatar picture={search.profile.picture} name={search.profile.name} size={24} />
              <span className="min-w-0 flex-1 truncate">{search.profile.name}</span>
              {search.profile_id === profileId && (
                <Badge variant="outline" className="text-muted-foreground">
                  Tvé oznámení
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {formationOpen && myTeamId === null && !iAmLooking && (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void setLooking(true)}>
          {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
          <UsersRound className="size-4" />
          Hledám tým
        </Button>
      )}

      {formationOpen && myTeamId === null && iAmLooking && (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void setLooking(false)}>
          {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
          Zrušit hledání
        </Button>
      )}
    </BirthGivingDetailSection>
  );
}