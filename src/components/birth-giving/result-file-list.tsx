"use client";

import { useState } from "react";
import { FileText, FolderSearch, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyMedia,
} from "@/components/ui/empty";
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
import { formatFileSize } from "@/lib/birth-giving/format";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import {
  canManageBirthGivingResult,
  canMarkBirthGivingResultMissing,
} from "@/lib/birth-giving/permissions";
import type {
  BirthGivingEventDetail,
  BirthGivingTeamDetail,
  BirthGivingTeamResultFile,
} from "@/lib/birth-giving/types";

interface BirthGivingResultFileListProps {
  event: BirthGivingEventDetail;
  team: BirthGivingTeamDetail;
  profileId: string;
  now: string;
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

interface PendingRemoval {
  file: BirthGivingTeamResultFile;
}

export function BirthGivingResultFileList({
  event,
  team,
  profileId,
  now,
  onEventChange,
}: BirthGivingResultFileListProps) {
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const [missingConfirmOpen, setMissingConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const clientNow = new Date(now);
  const canManage = canManageBirthGivingResult(event, team, profileId, clientNow);
  const canMarkMissing = canMarkBirthGivingResultMissing(event, team, profileId, clientNow);

  async function removeFile() {
    const file = pendingRemoval?.file;
    if (!file) return;
    setBusy(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/result-files/${file.id}`,
        { method: "DELETE" },
      );
      if (result.ok) {
        toast.success("Soubor byl smazán");
        setPendingRemoval(null);
        onEventChange(null);
        return;
      }
      toast.error(result.body.error ?? "Soubor se nepodařilo smazat");
      onEventChange(result.body.data ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function markMissing() {
    setBusy(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/teams/${team.id}/results/missing`,
      );
      if (result.ok) {
        toast.success("Výsledek byl označen jako nedohledaný");
        setMissingConfirmOpen(false);
        onEventChange(null);
        return;
      }
      toast.error(result.body.error ?? "Výsledek se nepodařilo označit jako nedohledaný");
      onEventChange(result.body.data ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {team.result_state === "missing" && (
        <Badge variant="outline" className="gap-1">
          <FolderSearch className="size-3" />
          Výsledek nedohledán
        </Badge>
      )}

      {team.result_files.length > 0 && (
        <ul className="space-y-1.5">
          {team.result_files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <a
                href={`/api/birth-giving/result-files/${file.id}/download`}
                className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline"
              >
                {file.original_file_name}
              </a>
              <span className="text-muted-foreground">{formatFileSize(file.file_size)}</span>
              {canManage && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  aria-label={`Smazat soubor ${file.original_file_name}`}
                  disabled={busy}
                  onClick={() => setPendingRemoval({ file })}
                >
                  <Trash2 className="size-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {team.result_files.length === 0 && team.result_state !== "missing" && (
        <Empty className="gap-3 border-dashed p-4">
          <EmptyMedia variant="icon">
            <FileText className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm">Zatím žádné soubory s výsledky.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}

      {canManage && (
        <BirthGivingFileUpload
          kind="results"
          eventId={event.id}
          teamId={team.id}
          onUploaded={() => onEventChange(null)}
        />
      )}

      {canMarkMissing && team.result_state !== "missing" && (
        <AlertDialog open={missingConfirmOpen} onOpenChange={setMissingConfirmOpen}>
          <Button type="button" variant="outline" size="sm" onClick={() => setMissingConfirmOpen(true)}>
            Označit výsledek jako nedohledaný
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Označit výsledek jako nedohledaný?</AlertDialogTitle>
              <AlertDialogDescription>
                Nahrané soubory se smažou a výsledek se označí jako nedohledaný.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline">Zrušit</Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button type="button" disabled={busy} onClick={() => void markMissing()}>
                  Potvrdit
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog open={pendingRemoval !== null} onOpenChange={(open) => { if (!open) setPendingRemoval(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat soubor s výsledky?</AlertDialogTitle>
            <AlertDialogDescription>
              Soubor {pendingRemoval?.file.original_file_name} se trvale odebere z archivů týmu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">Zrušit</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" disabled={busy} onClick={() => void removeFile()}>
                Potvrdit
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}