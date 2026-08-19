"use client";

import { useState } from "react";
import { CalendarClock, Factory, PencilLine, UserRound, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import { BirthGivingEventForm } from "./event-form";
import { BirthGivingEventStatusBadge } from "./event-status-badge";
import { BIRTH_GIVING_DURATION_LABELS } from "@/lib/birth-giving/constants";
import {
  canManageBirthGivingEventDetails,
  isBirthGivingOrganizer,
} from "@/lib/birth-giving/permissions";
import { getEventTimeState } from "@/lib/birth-giving/time";
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
  now,
  organizerProfiles,
  onEventChange,
}: BirthGivingEventMetadataProps) {
  const [editOpen, setEditOpen] = useState(false);
  const clientNow = new Date(now);
  const timeState = getEventTimeState(new Date(event.starts_at), event.duration, clientNow);
  const isOrganizer = isBirthGivingOrganizer(event, profileId);
  const canEdit = canManageBirthGivingEventDetails(event, profileId, clientNow);
  const startsAt = new Date(event.starts_at);

  return (
    <Card className="space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">{event.name}</h1>
            <BirthGivingEventStatusBadge
              joiningOpen={event.joining_open}
              timeState={timeState}
            />
            <Badge variant="outline" className="text-muted-foreground">
              {BIRTH_GIVING_DURATION_LABELS[event.duration]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{event.customer}</p>
          {isOrganizer && event.status === "draft" && (
            <Badge variant="secondary">Draft</Badge>
          )}
        </div>
        {canEdit && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <PencilLine className="size-4" />
            Upravit událost
          </Button>
        )}
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <dt className="flex items-center gap-1 text-muted-foreground">
            <CalendarClock className="size-3.5" />
            Začátek
          </dt>
          <dd>
            {startsAt.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" })}{" "}
            {startsAt.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="flex items-center gap-1 text-muted-foreground">
            <Factory className="size-3.5" />
            Velikost týmů
          </dt>
          <dd>{event.minimum_team_size}–{event.maximum_team_size}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="flex items-center gap-1 text-muted-foreground">
            <Users className="size-3.5" />
            Organizátoři
          </dt>
          <dd>{event.organizers.map((organizer) => organizer.profile.name).join(", ")}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="flex items-center gap-1 text-muted-foreground">
            <UserRound className="size-3.5" />
            Přihlašování
          </dt>
          <dd>{event.joining_open ? "Otevřené" : "Zavřené"}</dd>
        </div>
      </dl>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upravit událost</DialogTitle>
            <DialogDescription>
              Aktualizujte parametry zveřejněné události.
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
    </Card>
  );
}