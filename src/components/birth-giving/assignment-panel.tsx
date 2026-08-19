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
import { BirthGivingFileUpload } from "./file-upload";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import {
  canManageBirthGivingAssignment,
  canMarkBirthGivingAssignmentMissing,
} from "@/lib/birth-giving/permissions";
import { formatBirthGivingCountdown } from "@/lib/birth-giving/time";
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

interface BirthGivingAssignmentPanelProps {
  event: BirthGivingEventDetail;
  profileId: string;
  now: string;
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

const MINUTE_MILLISECONDS = 60 * 1000;

function formatFileSize(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round((bytes / 1_000) * 10) / 10} KB`;
  return `${Math.round((bytes / 1_000_000) * 10) / 10} MB`;
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
    const timer = setInterval(() => setClientNow(new Date()), MINUTE_MILLISECONDS);
    return () => clearInterval(timer);
  }, []);

  const assignment = event.assignment;
  const startsAt = new Date(event.starts_at);
  const released = clientNow.getTime() >= startsAt.getTime();
  const canManage = canManageBirthGivingAssignment(event, profileId, clientNow);
  const canMarkMissing = canMarkBirthGivingAssignmentMissing(event, profileId, clientNow);

  const state = assignment?.state;
  const canDownload = state === "present" && (released || canManage);

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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Zadání
        </h2>
        {state === "missing" && <Badge variant="outline">Zadání nedohledáno</Badge>}
      </div>

      {assignment && assignment.state === "present" && canDownload && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {assignment.original_file_name}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(assignment.file_size ?? 0)}
          </span>
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/birth-giving/events/${event.id}/assignment/download`}>
              <DownloadCloud className="size-4" />
              Stáhnout zadání
            </a>
          </Button>
        </div>
      )}

      {assignment && assignment.state === "present" && !released && !canManage && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4" />
          Zadání bude zveřejněno za{" "}
          {formatBirthGivingCountdown(startsAt.getTime() - clientNow.getTime())}
        </p>
      )}

      {!assignment && !canMarkMissing && !canManage && (
        <p className="text-sm text-muted-foreground">Zadání zatím nebylo nahráno.</p>
      )}

      {canManage && (
        <BirthGivingFileUpload
          kind="assignment"
          eventId={event.id}
          onUploaded={() => onEventChange(null)}
        />
      )}

      {canMarkMissing && !assignment && (
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
    </div>
  );
}