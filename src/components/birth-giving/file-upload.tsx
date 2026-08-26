"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, UploadCloud, X, FileCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BIRTH_GIVING_FILE_ACCEPT,
  birthGivingFileSchema,
} from "@/lib/birth-giving/files";
import { formatFileSize } from "@/lib/birth-giving/format";
import { cn } from "@/lib/utils";

interface AssignmentFileUploadProps {
  kind: "assignment";
  eventId: string;
  onUploaded: () => void;
  disabled?: boolean;
}

interface ResultFileUploadProps {
  kind: "results";
  eventId: string;
  teamId: string;
  onUploaded: () => void;
  disabled?: boolean;
}

type BirthGivingFileUploadProps = AssignmentFileUploadProps | ResultFileUploadProps;

interface PresignResponse {
  data?: { url: string; key: string };
  error?: string;
}

function putFile(url: string, file: File, onProgress: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error("Soubor se nepodařilo nahrát"));
    request.onerror = () => reject(new Error("Soubor se nepodařilo nahrát"));
    request.send(file);
  });
}

export function BirthGivingFileUpload(props: BirthGivingFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isResults = props.kind === "results";
  const inputId = isResults ? `bg-results-${props.teamId}` : `bg-assignment-${props.eventId}`;
  const inputLabel = isResults ? "Soubory s výsledky" : "Soubor se zadáním";

  function handleFileSelection(selected: File[]) {
    setError(null);
    setFiles(selected);
  }

  function pickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    handleFileSelection(Array.from(event.target.files ?? []));
  }

  function clearSelection() {
    setFiles([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeSelectedFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!props.disabled && !uploading) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (props.disabled || uploading) return;

    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (droppedFiles.length === 0) return;

    if (isResults) {
      handleFileSelection(droppedFiles);
    } else {
      const first = droppedFiles[0];
      if (first) handleFileSelection([first]);
    }
  }

  async function upload() {
    setError(null);
    for (const file of files) {
      if (!birthGivingFileSchema.safeParse({
        originalFileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      }).success) {
        setError("Tento typ souboru není povolený nebo přípona neodpovídá obsahu.");
        return;
      }
    }
    if (files.length === 0) {
      setError("Vyberte alespoň jeden soubor.");
      return;
    }

    setUploading(true);
    try {
      const basePath = isResults
        ? `/api/birth-giving/events/${props.eventId}/teams/${props.teamId}/results`
        : `/api/birth-giving/events/${props.eventId}/assignment`;
      for (const file of files) {
        setProgress(0);
        const metadata = { originalFileName: file.name, mimeType: file.type, fileSize: file.size };
        const presignResponse = await fetch(`${basePath}/presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metadata),
        });
        const presign = await presignResponse.json() as PresignResponse;
        if (!presignResponse.ok || !presign.data) throw new Error(presign.error ?? "Nahrávání se nepodařilo připravit");
        await putFile(presign.data.url, file, setProgress);
        const confirmResponse = await fetch(`${basePath}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...metadata, storagePath: presign.data.key }),
        });
        const confirmed = await confirmResponse.json() as { error?: string };
        if (!confirmResponse.ok) throw new Error(confirmed.error ?? "Nahraný soubor se nepodařilo potvrdit");
        props.onUploaded();
      }
      clearSelection();
      setProgress(100);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Soubor se nepodařilo nahrát");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2 pt-1">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        aria-label={inputLabel}
        accept={BIRTH_GIVING_FILE_ACCEPT}
        multiple={isResults}
        disabled={props.disabled || uploading}
        onChange={pickFiles}
        className="sr-only"
      />

      {files.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all cursor-pointer select-none",
            isDragging
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-border/60 bg-muted/20 hover:border-primary/50 hover:bg-muted/40",
            (props.disabled || uploading) && "pointer-events-none opacity-50",
          )}
        >
          <div
            className={cn(
              "flex size-11 items-center justify-center rounded-full transition-colors mb-2.5",
              isDragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
            )}
          >
            <UploadCloud className="size-5" />
          </div>

          <p className="text-xs sm:text-sm font-semibold text-foreground">
            {isDragging
              ? "Pusťte soubory pro nahrání"
              : isResults
              ? "Přetáhněte výsledky sem nebo klikněte pro výběr"
              : "Přetáhněte zadání sem nebo klikněte pro výběr"}
          </p>

          <p className="text-[11px] text-muted-foreground mt-1">
            PDF, prezentace, kód, archivy (max. 50 MB)
          </p>

          {/* Accessible trigger for testing & keyboard navigation */}
          <button
            type="button"
            className="sr-only"
            disabled={props.disabled || uploading}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            {isResults ? "Vybrat soubory s výsledky" : "Vybrat soubor se zadáním"}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileCheck className="size-4 text-primary" />
              Vybrané soubory ({files.length})
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-[11px] h-6 text-muted-foreground hover:text-foreground"
              disabled={uploading}
              onClick={clearSelection}
            >
              Zrušit výběr
            </Button>
          </div>

          <ul className="space-y-1.5">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-border/40 bg-card/70 px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {file.name}
                  <span className="ml-2 text-[11px] text-muted-foreground font-normal">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-label={`Odebrat ${file.name}`}
                  disabled={uploading}
                  onClick={() => removeSelectedFile(index)}
                  className="size-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={props.disabled || uploading}
              onClick={() => void upload()}
              className="gap-1.5 font-medium shadow-xs"
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {isResults ? "Nahrát soubory" : "Nahrát soubor"}
            </Button>
          </div>
        </div>
      )}

      {uploading && (
        <div className="space-y-1 pt-1" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Nahrávání…</span>
            <span className="tabular-nums font-medium text-foreground">{progress} %</span>
          </div>
          <Progress value={progress} aria-label="Průběh nahrávání" />
        </div>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
