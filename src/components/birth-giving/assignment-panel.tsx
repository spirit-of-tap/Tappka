"use client";

import { useEffect, useState } from "react";
import { FileText, Lock, DownloadCloud, Clock } from "lucide-react";
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
import { formatBirthGivingCountdown, MINUTE_MILLISECONDS } from "@/lib/birth-giving/time";
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
  const remainingMs = startsAt.getTime() - clientNow.getTime();

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
      icon={FileText}
      boxed={false}
      badge={state === "missing" && <Badge variant="outline" className="text-muted-foreground text-xs font-normal">Zadání nedohledáno</Badge>}
    >
      {state === "present" && canDownload && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/60 p-3 sm:p-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">
                {event.assignment_file_name ?? "Zadání"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(event.assignment_file_size ?? 0)}
                {!released && isOrganizer && " · Viditelné pouze organizátorům:kám do začátku akce"}
              </span>
            </div>
          </div>
          <Button size="sm" asChild>
            <a href={`/api/birth-giving/events/${event.id}/assignment/download`}>
              <DownloadCloud className="size-4" />
              Stáhnout zadání
            </a>
          </Button>
        </div>
      )}

      {!released && !isOrganizer && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 p-3.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 text-xs sm:text-sm">
            <Lock className="size-4 shrink-0 text-muted-foreground" />
            Zadání se zveřejní na začátku akce.
          </p>
          {remainingMs > 0 && remainingMs < 24 * 60 * 60 * 1000 && (
            <span className="flex items-center gap-1 text-xs font-medium text-foreground">
              <Clock className="size-3.5" />
              Zbývá {formatBirthGivingCountdown(remainingMs)}
            </span>
          )}
        </div>
      )}

      {released && state === "none" && !isOrganizer && (
        <p className="text-xs text-muted-foreground">Zadání zatím nebylo nahráno.</p>
      )}

      {isOrganizer && (
        <div className="space-y-3 pt-1">
          <BirthGivingFileUpload
            kind="assignment"
            eventId={event.id}
            onUploaded={() => onEventChange(null)}
          />
        </div>
      )}

      {isOrganizer && state !== "present" && state !== "missing" && (
        <AlertDialog open={missingConfirmOpen} onOpenChange={setMissingConfirmOpen}>
          <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setMissingConfirmOpen(true)}>
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