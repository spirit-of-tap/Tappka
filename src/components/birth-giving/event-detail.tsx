"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BirthGivingEventMetadata } from "./event-metadata";
import { BirthGivingAssignmentPanel } from "./assignment-panel";
import { BirthGivingTeamList } from "./team-list";
import { BirthGivingLookingForTeamList } from "./looking-for-team-list";
import type {
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
} from "@/lib/birth-giving/types";

interface BirthGivingEventDetailProps {
  event: BirthGivingEventDetail;
  profileId: string;
  organizerProfiles: BirthGivingProfileSummary[];
  now: string;
}

export function BirthGivingEventDetail({
  event: initialEvent,
  profileId,
  organizerProfiles,
  now,
}: BirthGivingEventDetailProps) {
  const router = useRouter();
  const [event, setEvent] = useState(initialEvent);

  useEffect(() => {
    setEvent(initialEvent);
  }, [initialEvent]);

  function handleEventChange(updated: BirthGivingEventDetail | null) {
    if (updated) {
      setEvent(updated);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Link
        href="/birth-giving"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Zpět na přehled
      </Link>

      <BirthGivingEventMetadata
        event={event}
        profileId={profileId}
        now={now}
        organizerProfiles={organizerProfiles}
        onEventChange={handleEventChange}
      />

      <BirthGivingAssignmentPanel
        event={event}
        profileId={profileId}
        now={now}
        onEventChange={handleEventChange}
      />

      <BirthGivingTeamList
        event={event}
        profileId={profileId}
        now={now}
        organizerProfiles={organizerProfiles}
        onEventChange={handleEventChange}
      />

      <BirthGivingLookingForTeamList
        event={event}
        profileId={profileId}
        now={now}
        onEventChange={handleEventChange}
      />
    </div>
  );
}