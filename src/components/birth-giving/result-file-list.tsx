"use client";

import { useState } from "react";
import { DownloadCloud, FileText, FolderSearch, Trash2 } from "lucide-react";
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
import { canUploadResults } from "@/lib/birth-giving/permissions";
import type {
  BirthGivingEventDetail,
  BirthGivingResultFile,
  BirthGivingTeamDetail,
} from "@/lib/birth-giving/types";

interface BirthGivingResultFileListProps {
  event: BirthGivingEventDetail;
  team: BirthGivingTeamDetail;
  profileId: string;
  now: string;
  disabled?: boolean;
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

interface PendingRemoval {
  file: BirthGivingResultFile;
}

export function BirthGivingResultFileList({
  event,
  team,
  profileId,
  now: _now,
  disabled = false,
  onEventChange,
}: BirthGivingResultFileListProps) {
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const [busy, setBusy] = useState(false);

  // When disabled (e.g. event concluded), uploading/deleting results is locked
  const canManage = !disabled && canUploadResults(event, team, profileId);

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

  return (
    <div className="space-y-2">
      {team.result_state === "missing" && (
        <Badge variant="outline" className="gap-1 text-muted-foreground text-xs">
          <FolderSearch className="size-3" />
          Výsledek nedohledán
        </Badge>
      )}

      {/* Uploaded files list */}
      {team.result_files.length > 0 && (
        <ul className="space-y-1.5">
          {team.result_files.map((file) => {
            const uploadedDate = file.uploaded_at ? new Date(file.uploaded_at) : null;
            const formattedDate = uploadedDate
              ? `${uploadedDate.toLocaleDateString("cs-CZ", {
                  day: "numeric",
                  month: "numeric",
                })} v ${uploadedDate.toLocaleTimeString("cs-CZ", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : null;

            return (
              <li
                key={file.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-muted/20 p-2.5 text-xs"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <FileText className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/api/birth-giving/result-files/${file.id}/download`}
                      className="inline-block truncate font-semibold text-foreground hover:text-primary hover:underline underline-offset-4"
                      title={file.original_file_name}
                    >
                      {file.original_file_name}
                    </a>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{formatFileSize(file.file_size)}</span>
                      {formattedDate && <span>· Odevzdáno {formattedDate}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button size="xs" variant="ghost" className="size-7 p-0" asChild>
                    <a
                      href={`/api/birth-giving/result-files/${file.id}/download`}
                      aria-label="Stáhnout"
                    >
                      <DownloadCloud className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </a>
                  </Button>
                  {canManage && (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="size-7 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Smazat soubor ${file.original_file_name}`}
                      disabled={busy || disabled}
                      onClick={() => setPendingRemoval({ file })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* If non-member or disabled and no files */}
      {team.result_files.length === 0 && !canManage && team.result_state !== "missing" && (
        <Empty className="gap-2 border-dashed p-3">
          <EmptyMedia variant="icon">
            <FileText className="size-4 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-xs text-muted-foreground">Zatím žádné soubory s výsledky.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}

      {/* Drag & drop upload area for active team members / organizers */}
      {canManage && (
        <BirthGivingFileUpload
          kind="results"
          eventId={event.id}
          teamId={team.id}
          disabled={disabled}
          onUploaded={() => onEventChange(null)}
        />
      )}

      {/* Remove file confirmation */}
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