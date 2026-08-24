"use client";

import { useEffect, useState } from "react";
import { FileText, Lock, DownloadCloud } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
import { BirthGivingDetailSection } from "./detail-section";
import { BirthGivingFileUpload } from "./file-upload";
import { formatFileSize } from "@/lib/birth-giving/format";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import { isBirthGivingOrganizer } from "@/lib/birth-giving/permissions";
import { MINUTE_MILLISECONDS } from "@/lib/birth-giving/time";
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

interface BirthGivingAssignmentPanelProps {
  event: BirthGivingEventDetail;
  profileId: string;
  now: string;
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

export function BirthGivingAssignmentPanel({
  event,
  profileId,
  now,
  onEventChange,
}: BirthGivingAssignmentPanelProps) {
  const [clientNow, setClientNow] = useState(() => new Date(now));
  const [missingConfirmOpen, setMissingConfirmOpen] = useState(false);
  const [markingMissing, setMarkingMissing] = useState(false);

  useEffect(() => {
    setClientNow(new Date(now));
  }, [now]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") setClientNow(new Date());
    };
    const timer = setInterval(tick, MINUTE_MILLISECONDS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const startsAt = new Date(event.starts_at);
  const released = clientNow.getTime() >= startsAt.getTime();
  const isOrganizer = isBirthGivingOrganizer(event, profileId);
  const state = event.assignment_state;
  const canDownload = state === "present" && (released || isOrganizer);

  async function markMissing() {
    setMarkingMissing(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/assignment/missing`,
      );
      if (result.ok) {
        toast.success("Zadání bylo označeno jako nedohledané");
        setMissingConfirmOpen(false);
        onEventChange(null);
        return;
      }
      toast.error(result.body.error ?? "Zadání se nepodařilo označit jako nedohledané");
      onEventChange(result.body.data ?? null);
    } finally {
      setMarkingMissing(false);
    }
  }

  return (
    <BirthGivingDetailSection
      title="Zadání"
      badge={state === "missing" && <Badge variant="outline">Zadání nedohledáno</Badge>}
    >
      {state === "present" && canDownload && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {event.assignment_file_name ?? "Zadání"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(event.assignment_file_size ?? 0)}
          </span>
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/birth-giving/events/${event.id}/assignment/download`}>
              <DownloadCloud className="size-4" />
              Stáhnout zadání
            </a>
          </Button>
        </div>
      )}

      {!released && !isOrganizer && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4" />
          Zadání se zveřejní na začátku akce.
        </p>
      )}

      {released && state === "none" && !isOrganizer && (
        <p className="text-sm text-muted-foreground">Zadání zatím nebylo nahráno.</p>
      )}

      {isOrganizer && (
        <BirthGivingFileUpload
          kind="assignment"
          eventId={event.id}
          onUploaded={() => onEventChange(null)}
        />
      )}

      {isOrganizer && state !== "present" && state !== "missing" && (
        <AlertDialog open={missingConfirmOpen} onOpenChange={setMissingConfirmOpen}>
          <Button type="button" variant="outline" onClick={() => setMissingConfirmOpen(true)}>
            Označit zadání jako nedohledané
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Označit zadání jako nedohledané?</AlertDialogTitle>
              <AlertDialogDescription>
                Zadání se nepodařilo dohledat. Tento stav událost zveřejnění nezablokuje.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline">Zrušit</Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button type="button" disabled={markingMissing} onClick={() => void markMissing()}>
                  Potvrdit
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </BirthGivingDetailSection>
  );
}