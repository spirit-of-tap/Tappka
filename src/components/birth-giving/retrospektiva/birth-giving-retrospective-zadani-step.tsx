"use client";

import { useState } from "react";
import { FileText, FolderSearch, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { BirthGivingFileUpload } from "@/components/birth-giving/file-upload";
import { formatFileSize } from "@/lib/birth-giving/format";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import {
  canManageBirthGivingAssignment,
  canMarkBirthGivingAssignmentMissing,
} from "@/lib/birth-giving/permissions";
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

interface BirthGivingRetrospectiveZadaniStepProps {
  event: BirthGivingEventDetail;
  profileId: string;
  now: string;
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

export function BirthGivingRetrospectiveZadaniStep({
  event,
  profileId,
  now,
  onEventChange,
}: BirthGivingRetrospectiveZadaniStepProps) {
  const [missingOpen, setMissingOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const clientNow = new Date(now);
  const assignment = event.assignment;
  const canManage = canManageBirthGivingAssignment(event, profileId, clientNow);
  const canMarkMissing = canMarkBirthGivingAssignmentMissing(event, profileId, clientNow);

  async function markMissing() {
    setBusy(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/assignment/missing`,
      );
      if (result.ok) {
        toast.success("Zadání bylo označeno jako nedohledané");
        setMissingOpen(false);
        onEventChange(null);
        return;
      }
      toast.error(result.body.error ?? "Zadání se nepodařilo označit jako nedohledané");
      onEventChange(result.body.data ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Nahrajte exportovanou kopii zadání, které týmy dostaly, nebo výslovně označte,
        že se zadání nepodařilo dohledat.
      </p>

      {assignment?.state === "present" && (
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {assignment.original_file_name}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(assignment.file_size ?? 0)}
          </span>
          <Badge variant="outline">Zadání nahráno</Badge>
        </Card>
      )}

      {assignment?.state === "missing" && (
        <Badge variant="outline" className="gap-1">
          <FolderSearch className="size-3" />
          Zadání nedohledáno
        </Badge>
      )}

      {!assignment && (
        <p className="text-sm text-muted-foreground">
          Zadání zatím nebylo potvrzeno. Nedohledané zadání zveřejnění nezablokuje.
        </p>
      )}

      {canManage && (
        <BirthGivingFileUpload
          kind="assignment"
          eventId={event.id}
          onUploaded={() => onEventChange(null)}
          disabled={busy}
        />
      )}

      {canMarkMissing && !assignment && (
        <AlertDialog open={missingOpen} onOpenChange={setMissingOpen}>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !canManage}
            onClick={() => setMissingOpen(true)}
          >
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
                <Button type="button" disabled={busy} onClick={() => void markMissing()}>
                  {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
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