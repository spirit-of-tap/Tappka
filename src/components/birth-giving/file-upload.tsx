"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BIRTH_GIVING_FILE_ACCEPT,
  birthGivingFileSchema,
} from "@/lib/birth-giving/files";
import { formatFileSize } from "@/lib/birth-giving/format";

const EXTERNAL_LINK_WARNING = "Nahrajte exportovanou kopii souboru. Odkazy na Canvu, Google Drive a další služby mohou později ztratit přístup, takže nejsou spolehlivým výsledkem BG.";
const ASSIGNMENT_RELEASE_WARNING = "Soubor se zadáním bude týmům dostupný až od začátku BG. Pokud ho během BG nahradíte, odešleme týmům e-mail s upozorněním.";

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
  const isResults = props.kind === "results";
  const inputId = isResults ? `bg-results-${props.teamId}` : `bg-assignment-${props.eventId}`;
  const inputLabel = isResults ? "Soubory s výsledky" : "Soubor se zadáním";

  function pickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setFiles(Array.from(event.target.files ?? []));
  }

  function clearSelection() {
    setFiles([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
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
    <div className="space-y-2">
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
        <Button
          type="button"
          variant="outline"
          disabled={props.disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full justify-start gap-2 border-dashed text-muted-foreground"
        >
          <Upload className="size-4" />
          {isResults ? "Vybrat soubory s výsledky" : "Vybrat soubor se zadáním"}
        </Button>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-1.5">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={props.disabled || uploading} onClick={() => void upload()}>
              {uploading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Upload className="size-4" />}
              {isResults ? "Nahrát soubory" : "Nahrát soubor"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              aria-label="Zrušit výběr souboru"
              disabled={uploading}
              onClick={clearSelection}
            >
              <X className="size-3" />
            </Button>
          </div>
        </div>
      )}

      {!isResults && <p className="text-xs text-muted-foreground">{ASSIGNMENT_RELEASE_WARNING}</p>}
      <p className="text-xs text-muted-foreground">{EXTERNAL_LINK_WARNING}</p>

      {uploading && (
        <div className="flex items-center gap-3" aria-live="polite">
          <Progress value={progress} aria-label="Průběh nahrávání" />
          <span className="min-w-12 text-sm tabular-nums">{progress} %</span>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
