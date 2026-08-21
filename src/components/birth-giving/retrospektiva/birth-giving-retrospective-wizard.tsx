"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
  BirthGivingDuplicateCandidateItem,
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
} from "@/lib/birth-giving/types";

interface BirthGivingRetrospectiveWizardProps {
  profileId: string;
  organizerProfiles: BirthGivingProfileSummary[];
}

const STEP_LABELS = ["Událost", "Zadání", "Týmy a výsledky", "Kontrola"] as const;

const NEXT_LABELS: Record<number, string> = {
  0: "Pokračovat na Zadání",
  1: "Pokračovat na Týmy a výsledky",
  2: "Pokračovat na kontrolu",
};

export function BirthGivingRetrospectiveWizard({
  profileId,
  organizerProfiles,
}: BirthGivingRetrospectiveWizardProps) {
  const router = useRouter();
  const [event, setEvent] = useState<BirthGivingEventDetail | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<BirthGivingDuplicateCandidateItem[]>([]);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [exactDuplicate, setExactDuplicate] = useState<BirthGivingDuplicateCandidateItem | null>(
    null,
  );
  const [identityCollision, setIdentityCollision] = useState(false);
  const [hiddenConflict, setHiddenConflict] = useState(false);
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<BirthGivingRetrospectiveEventPayload | null>(
    null,
  );
  const [publishError, setPublishError] = useState<string | null>(null);
  const [now] = useState(() => new Date().toISOString());

  async function handleEventStepSubmit(payload: BirthGivingRetrospectiveEventPayload) {
    setPendingPayload(payload);
    if (!event && !duplicateConfirmed && !resumeDraftId) {
      const blocked = await checkNearDuplicates(payload);
      if (blocked) return;
    }
    await upsertDraft(payload);
  }

  async function checkNearDuplicates(
    payload: BirthGivingRetrospectiveEventPayload,
  ): Promise<boolean> {
    const check = await birthGivingMutationRequest<BirthGivingDuplicateCandidateItem[]>(
      "/api/birth-giving/events/duplicate-candidates",
      {
        body: {
          name: payload.name,
          customer: payload.customer,
          startsAt: payload.startsAt,
        },
      },
    );
    if (!check.ok) {
      toast.error(check.body.error ?? "Kontrolu podobných událostí se nepodařilo dokončit");
      return true;
    }
    const candidates = check.body.data ?? [];
    if (candidates.length > 0) {
      setDuplicates(candidates);
      return true;
    }
    return false;
  }

  async function upsertDraft(payload: BirthGivingRetrospectiveEventPayload) {
    setBusy(true);
    try {
      const path = event ? `/api/birth-giving/events/${event.id}` : "/api/birth-giving/events";
      const result = await birthGivingMutationRequest(path, {
        method: event ? "PATCH" : "POST",
        body: payload,
      });
      if (result.ok && result.body.data) {
        setEvent(result.body.data);
        setDuplicates([]);
        setDuplicateConfirmed(false);
        setExactDuplicate(null);
        setIdentityCollision(false);
        setResumeDraftId(null);
        setHiddenConflict(false);
        setPendingPayload(null);
        return;
      }
      if (result.body.code === "DUPLICATE_EVENT") {
        handleDuplicateConflict(result.body.data);
        return;
      }
      toast.error(result.body.error ?? "Událost se nepodařilo uložit");
    } finally {
      setBusy(false);
    }
  }

  function handleDuplicateConflict(data: unknown) {
    const conflict = parseDuplicateConflict(data, event?.id ?? null);
    if (conflict.kind === "draft-resume") {
      setResumeDraftId(conflict.candidate.id);
      setDuplicates([]);
      setExactDuplicate(null);
      setIdentityCollision(false);
      setHiddenConflict(false);
      return;
    }
    if (conflict.kind === "published-exact") {
      setExactDuplicate(conflict.candidate);
      setDuplicates([]);
      setDuplicateConfirmed(false);
      setIdentityCollision(false);
      setHiddenConflict(false);
      return;
    }
    setDuplicates([]);
    setExactDuplicate(null);
    setResumeDraftId(null);
    if (conflict.kind === "identity-collision") {
      setHiddenConflict(false);
      setIdentityCollision(true);
      return;
    }
    setIdentityCollision(false);
    setHiddenConflict(true);
  }

  async function resumeDraft() {
    if (!resumeDraftId) return;
    setBusy(true);
    try {
      const result = await birthGivingMutationRequest<BirthGivingEventDetail>(
        `/api/birth-giving/events/${resumeDraftId}`,
        { method: "GET" },
      );
      if (result.ok && result.body.data) {
        setEvent(result.body.data);
        setResumeDraftId(null);
        setDuplicates([]);
        setExactDuplicate(null);
        setIdentityCollision(false);
        setHiddenConflict(false);
        setPendingPayload(null);
        return;
      }
      toast.error(result.body.error ?? "Rozepsaný koncept se nepodařilo načíst");
    } finally {
      setBusy(false);
    }
  }

  function cancelDuplicateGate() {
    setDuplicates([]);
    setResumeDraftId(null);
    setExactDuplicate(null);
    setIdentityCollision(false);
    setHiddenConflict(false);
    setPendingPayload(null);
  }

  async function refreshEvent() {
    if (!event) return;
    try {
      const result = await birthGivingMutationRequest<BirthGivingEventDetail>(
        `/api/birth-giving/events/${event.id}`,
        { method: "GET" },
      );
      if (result.ok && result.body.data) {
        setEvent(result.body.data);
        return;
      }
      if (result.ok) {
        setEvent(null);
        setStepIndex(0);
      }
    } catch {
      // A failed refresh keeps the last canonical state; the next mutation retries.
    }
  }

  function handleEventChange(updated: BirthGivingEventDetail | null) {
    if (updated) {
      setEvent(updated);
      return;
    }
    void refreshEvent();
  }

  function confirmDuplicate() {
    if (!pendingPayload) return;
    setDuplicateConfirmed(true);
    void upsertDraft(pendingPayload);
  }

  async function publish() {
    if (!event) return;
    setBusy(true);
    setPublishError(null);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/publish`,
      );
      if (result.ok && result.body.data) {
        toast.success("Událost byla zveřejněna");
        router.push(`/birth-giving/${event.id}`);
        return;
      }
      if (
        result.body.data
        && typeof result.body.data === "object"
        && "id" in result.body.data
      ) {
        setEvent(result.body.data as BirthGivingEventDetail);
      }
      if (
        result.body.code === "PUBLICATION_INVALID"
        || result.body.code === "EVENT_LOCKED"
      ) {
        setPublishError(result.body.error ?? "Událost nelze v této fázi zveřejnit.");
        return;
      }
      setPublishError(result.body.error ?? "Událost se nepodařilo zveřejnit");
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  function goNext() {
    if (!event) return;
    setStepIndex((index) => Math.min(index + 1, STEP_LABELS.length - 1));
  }

  function goToStep(index: number) {
    if (index >= stepIndex) return;
    setStepIndex(index);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <BirthGivingWizardSteps
        steps={STEP_LABELS}
        currentIndex={stepIndex}
        onStepClick={goToStep}
      />

      <Card className="space-y-4 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b pb-3">
          <h2 className="text-base font-semibold">{STEP_LABELS[stepIndex]}</h2>
        </div>

        {stepIndex === 0 && (
          <BirthGivingRetrospectiveEventStep
            key={event?.id ?? "new-draft"}
            event={event}
            profileId={profileId}
            organizerProfiles={organizerProfiles}
            busy={busy}
            duplicates={duplicates}
            exactDuplicate={exactDuplicate}
            resumeDraftId={resumeDraftId}
            identityCollision={identityCollision}
            hiddenConflict={hiddenConflict}
            onSubmit={(payload) => void handleEventStepSubmit(payload)}
            onConfirmDuplicate={confirmDuplicate}
            onCancelDuplicate={cancelDuplicateGate}
            onResumeDraft={() => void resumeDraft()}
          />
        )}
        {stepIndex === 1 && event && (
          <BirthGivingRetrospectiveZadaniStep
            event={event}
            profileId={profileId}
            now={now}
            onEventChange={handleEventChange}
          />
        )}
        {stepIndex === 2 && event && (
          <BirthGivingRetrospectiveTeamsStep
            event={event}
            profileId={profileId}
            organizerProfiles={organizerProfiles}
            now={now}
            onEventChange={handleEventChange}
          />
        )}
        {stepIndex === 3 && event && (
          <BirthGivingRetrospectiveReviewStep
            event={event}
            busy={busy}
            publishError={publishError}
            onPublish={() => void publish()}
          />
        )}

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            disabled={stepIndex === 0 || busy}
            onClick={goBack}
          >
            Zpět
          </Button>
          {stepIndex < STEP_LABELS.length - 1 && (
            <Button type="button" disabled={!event || busy} onClick={goNext}>
              {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
              {NEXT_LABELS[stepIndex]}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

type DuplicateConflictParseResult =
  | { kind: "draft-resume"; candidate: BirthGivingDuplicateCandidateItem }
  | { kind: "published-exact"; candidate: BirthGivingDuplicateCandidateItem }
  | { kind: "identity-collision" }
  | { kind: "hidden" };

function parseDuplicateConflict(
  data: unknown,
  currentEventId: string | null,
): DuplicateConflictParseResult {
  if (typeof data !== "object" || data === null || !("id" in data)) {
    return { kind: "hidden" };
  }
  const raw = data as {
    id?: unknown;
    status?: unknown;
    identity?: { eventName?: unknown; customer?: unknown; startsAt?: unknown };
  };
  if (typeof raw.id !== "string") return { kind: "hidden" };
  if (raw.id === currentEventId) return { kind: "identity-collision" };
  const identity = raw.identity;
  const candidate: BirthGivingDuplicateCandidateItem = {
    id: raw.id,
    status: raw.status === "draft" ? "draft" : "published",
    name: typeof identity?.eventName === "string" ? identity.eventName : "",
    customer: typeof identity?.customer === "string" ? identity.customer : "",
    starts_at: typeof identity?.startsAt === "string" ? identity.startsAt : "",
  };
  return {
    kind: candidate.status === "draft" ? "draft-resume" : "published-exact",
    candidate,
  };
}