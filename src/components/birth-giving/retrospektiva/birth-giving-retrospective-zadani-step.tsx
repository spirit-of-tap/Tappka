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
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

interface BirthGivingRetrospectiveZadaniStepProps {
  event: BirthGivingEventDetail;
  profileId: string;
  now: string;
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

export function BirthGivingRetrospectiveZadaniStep({
  event,
  profileId: _profileId,
  now: _now,
  onEventChange,
}: BirthGivingRetrospectiveZadaniStepProps) {
  const [missingOpen, setMissingOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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

      {event.assignment_state === "present" && (
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {event.assignment_file_name ?? "Zadání"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(event.assignment_file_size ?? 0)}
          </span>
          <Badge variant="outline">Zadání nahráno</Badge>
        </Card>
      )}

      {event.assignment_state === "missing" && (
        <Badge variant="outline" className="gap-1">
          <FolderSearch className="size-3" />
          Zadání nedohledáno
        </Badge>
      )}

      {event.assignment_state === "none" && (
        <p className="text-sm text-muted-foreground">
          Zadání zatím nebylo nahráno. Nedohledané zadání zveřejnění nezablokuje.
        </p>
      )}

      <BirthGivingFileUpload
        kind="assignment"
        eventId={event.id}
        onUploaded={() => onEventChange(null)}
      />

      {event.assignment_state !== "missing" && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMissingOpen(true)}
          >
            Označit zadání jako nedohledané
          </Button>

          <AlertDialog open={missingOpen} onOpenChange={setMissingOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Označit zadání jako nedohledané?</AlertDialogTitle>
                <AlertDialogDescription>
                  Potvrďte, že se původní zadání nepodařilo najít. Tento stav nezablokuje
                  zveřejnění události.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button type="button" variant="outline">
                    Zrušit
                  </Button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void markMissing()}
                  >
                    {busy && (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    )}
                    Potvrdit
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}