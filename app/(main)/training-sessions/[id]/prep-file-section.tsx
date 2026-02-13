/**
 * Prep File Section Component
 *
 * Displays the preparation file (Příprava) for a training session.
 * - Facilitators can upload/delete
 * - Everyone can download
 */

"use client";

import { useState, useRef, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, Trash2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

interface PrepFileSectionProps {
  sessionId: string;
  prepFileName: string | null;
  isFacilitator: boolean;
}

export function PrepFileSection({
  sessionId,
  prepFileName,
  isFacilitator,
}: PrepFileSectionProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Povolené formáty: PDF, DOCX, TXT");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Maximální velikost souboru je 20MB");
      return;
    }

    setIsUploading(true);

    try {
      // Step 1: Get presigned upload URL
      const presignResponse = await fetch(
        `/api/training-sessions/${sessionId}/prep`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "presign",
            contentType: file.type,
            fileSize: file.size,
            fileName: file.name,
          }),
        }
      );

      if (!presignResponse.ok) {
        const error = await presignResponse.json();
        throw new Error(error.error || "Nepodařilo se získat URL pro nahrávání");
      }

      const { data: presignData } = await presignResponse.json();

      // Step 2: Upload directly to B2 using PUT
      const uploadResponse = await fetch(presignData.url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
        mode: "cors",
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("Upload failed:", uploadResponse.status, errorText);
        throw new Error(`Nahrávání selhalo (${uploadResponse.status})`);
      }

      // Step 3: Confirm upload
      const confirmResponse = await fetch(
        `/api/training-sessions/${sessionId}/prep`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm",
            key: presignData.key,
            fileName: file.name,
          }),
        }
      );

      if (!confirmResponse.ok) {
        const error = await confirmResponse.json();
        throw new Error(error.error || "Nepodařilo se potvrdit nahrání");
      }

      toast.success("Příprava byla úspěšně nahrána");
      router.refresh();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Nepodařilo se nahrát soubor"
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      const response = await fetch(
        `/api/training-sessions/${sessionId}/prep`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Nepodařilo se stáhnout soubor");
      }

      const { data } = await response.json();

      // Open download in new tab
      window.open(data.url, "_blank");
    } catch (error) {
      console.error("Download error:", error);
      toast.error(
        error instanceof Error ? error.message : "Nepodařilo se stáhnout soubor"
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Opravdu chcete smazat přípravu?")) return;

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/training-sessions/${sessionId}/prep`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Nepodařilo se smazat soubor");
      }

      toast.success("Příprava byla smazána");
      router.refresh();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(
        error instanceof Error ? error.message : "Nepodařilo se smazat soubor"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const isLoading = isUploading || isDownloading || isDeleting;

  // Hidden file input (always rendered)
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
      onChange={handleFileSelect}
      className="hidden"
    />
  );

  // File exists - prominent download card
  if (prepFileName) {
    return (
      <div className="rounded-xl bg-primary/5 p-5">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="size-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Příprava</p>
            <p className="font-semibold truncate">{prepFileName}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={handleDownload}
              disabled={isLoading}
              size="sm"
            >
              {isDownloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Download className="size-4 mr-2" />
                  Stáhnout
                </>
              )}
            </Button>
            {isFacilitator && (
              <Button
                onClick={handleDelete}
                disabled={isLoading}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            )}
          </div>
        </div>
        
        {/* Replace option for facilitators */}
        {isFacilitator && (
          <div className="mt-3 pt-3 border-t border-primary/10">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isUploading ? "Nahrávání..." : "Nahrát novou přípravu"}
            </button>
          </div>
        )}
        {fileInput}
      </div>
    );
  }

  // No file - empty state
  if (isFacilitator) {
    return (
      <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-muted mb-3">
            <FileText className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Příprava nebyla nahrána
          </p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            variant="outline"
          >
            {isUploading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Nahrávání...
              </>
            ) : (
              <>
                <Upload className="size-4 mr-2" />
                Nahrát přípravu
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            PDF, DOCX, TXT (max 20MB)
          </p>
        </div>
        {fileInput}
      </div>
    );
  }

  // No file, not a facilitator - minimal message
  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <div className="flex items-center gap-3 text-muted-foreground">
        <FileText className="size-5" />
        <span className="text-sm">Příprava nebyla nahrána</span>
      </div>
    </div>
  );
}
