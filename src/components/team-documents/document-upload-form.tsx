"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MAX_DOCUMENT_SIZE } from "@/lib/storage/validation"
import type {
  TeamDocument,
  TeamDocumentType,
  TeamDocumentVersionWithCreator,
  TeamDocumentWithVersions,
} from "@/lib/team-documents/types"

const PDF_CONTENT_TYPE = "application/pdf"

interface DocumentUploadFormProps {
  document: TeamDocumentWithVersions | null
  documentType: TeamDocumentType
  onSuccess: (
    document: TeamDocumentWithVersions,
    version: TeamDocumentVersionWithCreator,
  ) => void
  onCancel: () => void
}

export function DocumentUploadForm({
  document,
  documentType,
  onSuccess,
  onCancel,
}: DocumentUploadFormProps) {
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [effectiveFrom, setEffectiveFrom] = useState("")
  const [changeNote, setChangeNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (documentType === "other" && !document && !title.trim()) {
      setError("Zadejte název dokumentu.")
      return
    }
    if (!file || file.type !== PDF_CONTENT_TYPE) {
      setError("Vyberte soubor ve formátu PDF.")
      return
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      setError(`Maximální velikost souboru je ${MAX_DOCUMENT_SIZE / 1024 / 1024} MB.`)
      return
    }

    setLoading(true)
    try {
      let targetDocument = document
      if (!targetDocument) {
        const createResponse = await fetch("/api/team-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docType: documentType,
            ...(documentType === "other" ? { title: title.trim() } : {}),
          }),
        })
        const createJson = await createResponse.json()
        if (!createResponse.ok || !createJson.data) {
          throw new Error(createJson.error ?? "Dokument se nepodařilo vytvořit")
        }
        targetDocument = {
          ...(createJson.data as TeamDocument),
          versions: [],
        }
      }

      const presignResponse = await fetch("/api/storage/presign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: "team-document",
          entityId: targetDocument.id,
          contentType: file.type,
          fileSize: file.size,
        }),
      })
      const presignJson = await presignResponse.json()
      if (!presignResponse.ok || !presignJson.data) {
        throw new Error(presignJson.error ?? "Nahrávání se nepodařilo připravit")
      }
      const { url, key } = presignJson.data as { url: string; key: string }

      const uploadResponse = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!uploadResponse.ok) throw new Error("Soubor se nepodařilo nahrát")

      const versionResponse = await fetch(`/api/team-documents/${targetDocument.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          fileName: file.name,
          fileSize: file.size,
          effectiveFrom: effectiveFrom || null,
          changeNote: changeNote.trim() || null,
        }),
      })
      const versionJson = await versionResponse.json()
      if (!versionResponse.ok || !versionJson.data) {
        throw new Error(versionJson.error ?? "Verzi se nepodařilo uložit")
      }

      onSuccess(targetDocument, versionJson.data as TeamDocumentVersionWithCreator)
      toast.success(document ? "Nová verze je nahraná" : "Dokument je nahraný")
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : "Dokument se nepodařilo nahrát"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {documentType === "other" && !document && (
        <div className="space-y-2">
          <Label htmlFor="team-document-title">Název dokumentu</Label>
          <Input
            id="team-document-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Např. Pravidla porad"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="team-document-file">Soubor PDF</Label>
        <Input
          id="team-document-file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          PDF · max {MAX_DOCUMENT_SIZE / 1024 / 1024} MB
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="team-document-effective-from">Účinnost od (volitelné)</Label>
        <Input
          id="team-document-effective-from"
          type="date"
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="team-document-change-note">Poznámka ke změně (volitelné)</Label>
        <Textarea
          id="team-document-change-note"
          value={changeNote}
          onChange={(event) => setChangeNote(event.target.value)}
          maxLength={1000}
          placeholder="Co se v této verzi změnilo?"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          Nahrát verzi
        </Button>
      </div>
    </form>
  )
}
