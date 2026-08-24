"use client";

import { useState } from "react";
import { CalendarClock, Loader2, PencilLine, Rocket, Users, Briefcase } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import { BirthGivingEventForm } from "./event-form";
import { BIRTH_GIVING_DURATION_LABELS } from "@/lib/birth-giving/constants";
import { calculateEventEnd } from "@/lib/birth-giving/time";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import { isBirthGivingOrganizer } from "@/lib/birth-giving/permissions";
import type {
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
} from "@/lib/birth-giving/types";

interface BirthGivingEventMetadataProps {
  event: BirthGivingEventDetail;
  profileId: string;
  now: string;
  organizerProfiles: BirthGivingProfileSummary[];
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

export function BirthGivingEventMetadata({
  event,
  profileId,
  now: _now,
  organizerProfiles,
  onEventChange,
}: BirthGivingEventMetadataProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const isOrganizer = isBirthGivingOrganizer(event, profileId);
  const startsAt = new Date(event.starts_at);
  const endsAt = calculateEventEnd(startsAt, event.duration);
  const canPublish = event.status === "draft" && isOrganizer;

  async function publishDraft() {
    setPublishing(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/publish`,
      );
      if (result.ok && result.body.data) {
        toast.success("Událost byla zveřejněna");
        onEventChange(result.body.data);
        return;
      }
      toast.error(result.body.error ?? "Událost se nepodařilo zveřejnit");
      onEventChange(result.body.data ?? null);
    } finally {
      setPublishing(false);
    }
  }

  const startFormatted = `${startsAt.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })} v ${startsAt.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`;

  const endFormatted = `${endsAt.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })} v ${endsAt.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="space-y-3 pt-1">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {event.name}
            </h1>
            <Badge variant="outline" className="text-muted-foreground font-medium">
              {BIRTH_GIVING_DURATION_LABELS[event.duration]}
            </Badge>
            {event.status === "draft" && (
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                Koncept
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Briefcase className="size-4 shrink-0 text-muted-foreground" />
              <span>{event.customer}</span>
            </span>

            <span className="flex flex-wrap items-center gap-1.5">
              <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
              <span>Začátek:</span>
              <span className="font-medium text-foreground">{startFormatted}</span>
              <span className="text-muted-foreground/60">·</span>
              <span>Konec:</span>
              <span className="font-medium text-foreground">{endFormatted}</span>
            </span>

            <span className="flex items-center gap-1.5">
              <Users className="size-4 shrink-0 text-muted-foreground" />
              <span>Organizátoři:ky</span>
              <span className="font-medium text-foreground">
                {event.organizers.map((organizer) => organizer.name).filter(Boolean).join(", ") || "–"}
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canPublish && (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={publishing}
              onClick={() => void publishDraft()}
            >
              {publishing ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <Rocket className="size-4" />
              )}
              Zveřejnit
            </Button>
          )}
          {isOrganizer && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <PencilLine className="size-4" />
              Upravit událost
            </Button>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upravit událost</DialogTitle>
            <DialogDescription>
              Aktualizujte parametry události.
            </DialogDescription>
          </DialogHeader>
          <BirthGivingEventForm
            event={event}
            profileId={profileId}
            organizerProfiles={organizerProfiles}
            onSuccess={(updated) => {
              setEditOpen(false);
              onEventChange(updated);
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}