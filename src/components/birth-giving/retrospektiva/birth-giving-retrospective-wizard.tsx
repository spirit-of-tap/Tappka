"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BirthGivingRetrospectiveEventStep } from "./birth-giving-retrospective-event-step";
import { BirthGivingRetrospectiveZadaniStep } from "./birth-giving-retrospective-zadani-step";
import { BirthGivingRetrospectiveTeamsStep } from "./birth-giving-retrospective-teams-step";
import { BirthGivingRetrospectiveReviewStep } from "./birth-giving-retrospective-review-step";
import { BirthGivingWizardSteps } from "./wizard-steps";
import type { BirthGivingRetrospectiveEventPayload } from "./birth-giving-retrospective-event-step";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import type {
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
} from "@/lib/birth-giving/types";

interface BirthGivingRetrospectiveWizardProps {
  profileId: string;
  organizerProfiles: BirthGivingProfileSummary[];
}

const STEP_LABELS = ["Událost", "Zadání", "Týmy a výsledky", "Kontrola"] as const;

export function BirthGivingRetrospectiveWizard({
  profileId,
  organizerProfiles,
}: BirthGivingRetrospectiveWizardProps) {
  const router = useRouter();
  const [event, setEvent] = useState<BirthGivingEventDetail | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [now] = useState(() => new Date().toISOString());

  async function handleEventStepSubmit(payload: BirthGivingRetrospectiveEventPayload) {
    setBusy(true);
    try {
      const path = event ? `/api/birth-giving/events/${event.id}` : "/api/birth-giving/events";
      const result = await birthGivingMutationRequest(path, {
        method: event ? "PATCH" : "POST",
        body: payload,
      });
      if (result.ok && result.body.data) {
        setEvent(result.body.data);
        setStepIndex(1);
        toast.success(event ? "Událost byla aktualizována" : "Koncept byl vytvořen");
        return;
      }
      toast.error(result.body.error ?? "Událost se nepodařilo uložit");
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!event) return;
    setBusy(true);
    setPublishError(null);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/publish`,
      );
      if (result.ok && result.body.data) {
        toast.success("Událost byla úspěšně zveřejněna");
        router.push(`/birth-giving/${event.id}`);
        return;
      }
      setPublishError(result.body.error ?? "Událost se nepodařilo zveřejnit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <BirthGivingWizardSteps
        steps={STEP_LABELS}
        currentIndex={stepIndex}
        onStepClick={(target: number) => {
          if (event || target === 0) setStepIndex(target);
        }}
      />

      <Card className="p-3 sm:p-5">
        {stepIndex === 0 && (
          <BirthGivingRetrospectiveEventStep
            event={event}
            profileId={profileId}
            organizerProfiles={organizerProfiles}
            busy={busy}
            onSubmit={handleEventStepSubmit}
          />
        )}

        {stepIndex === 1 && event && (
          <div className="space-y-4">
            <BirthGivingRetrospectiveZadaniStep
              event={event}
              profileId={profileId}
              now={now}
              onEventChange={setEvent}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStepIndex(0)}
              >
                Zpět
              </Button>
              <Button
                type="button"
                onClick={() => setStepIndex(2)}
              >
                Pokračovat na Týmy a výsledky
              </Button>
            </div>
          </div>
        )}

        {stepIndex === 2 && event && (
          <div className="space-y-4">
            <BirthGivingRetrospectiveTeamsStep
              event={event}
              profileId={profileId}
              organizerProfiles={organizerProfiles}
              now={now}
              onEventChange={setEvent}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStepIndex(1)}
              >
                Zpět
              </Button>
              <Button
                type="button"
                onClick={() => setStepIndex(3)}
              >
                Pokračovat na kontrolu
              </Button>
            </div>
          </div>
        )}

        {stepIndex === 3 && event && (
          <BirthGivingRetrospectiveReviewStep
            event={event}
            busy={busy}
            publishError={publishError}
            onPublish={handlePublish}
          />
        )}
      </Card>
    </div>
  );
}