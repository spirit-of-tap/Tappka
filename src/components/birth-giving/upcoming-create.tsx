"use client";

import { useRouter } from "next/navigation";

import { BirthGivingEventForm } from "@/components/birth-giving/event-form";
import type { BirthGivingProfileSummary } from "@/lib/birth-giving/types";

interface BirthGivingUpcomingCreateProps {
  profileId: string;
  organizerProfiles: BirthGivingProfileSummary[];
}

export function BirthGivingUpcomingCreate({
  profileId,
  organizerProfiles,
}: BirthGivingUpcomingCreateProps) {
  const router = useRouter();

  return (
    <BirthGivingEventForm
      profileId={profileId}
      organizerProfiles={organizerProfiles}
      onSuccess={(event) => router.push(`/birth-giving/${event.id}`)}
      onCancel={() => router.push("/birth-giving")}
    />
  );
}