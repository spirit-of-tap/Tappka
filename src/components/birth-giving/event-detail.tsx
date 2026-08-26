"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PageBack } from "@/components/ui/page-back";
import { BirthGivingEventMetadata } from "./event-metadata";
import { BirthGivingEventOverviewStrip } from "./event-overview-strip";
import { BirthGivingAssignmentPanel } from "./assignment-panel";
import { BirthGivingTeamList } from "./team-list";
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
    <div className="space-y-5">
      <PageBack href="/birth-giving" label="Zpět na přehled" />

      <BirthGivingEventMetadata
        event={event}
        profileId={profileId}
        now={now}
        organizerProfiles={organizerProfiles}
        onEventChange={handleEventChange}
      />

      <BirthGivingEventOverviewStrip event={event} />

      <div className="space-y-6 pt-2">
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
      </div>
    </div>
  );
}