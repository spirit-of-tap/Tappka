"use client"

import { useState } from "react"
import { FolderPlus } from "lucide-react"
import { toast } from "sonner"

import { DocumentUploadForm } from "./document-upload-form"
import { TeamDocumentCard } from "./team-document-card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog"
import {
  getTeamDocumentTitle,
  type TeamDocumentType,
  type TeamDocumentVersionWithCreator,
  type TeamDocumentWithVersions,
} from "@/lib/team-documents/types"

interface TeamDocumentsProps {
  teamId: string
  initialDocuments: TeamDocumentWithVersions[]
}

interface UploadTarget {
  document: TeamDocumentWithVersions | null
  documentType: TeamDocumentType
}

const FEATURED_TYPES = ["team_contract", "financial_policy"] as const

export function TeamDocuments({ initialDocuments }: TeamDocumentsProps) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null)
  const [renameDocument, setRenameDocument] = useState<TeamDocumentWithVersions | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [renaming, setRenaming] = useState(false)

  function handleVersionUploaded(
    targetDocument: TeamDocumentWithVersions,
    version: TeamDocumentVersionWithCreator,
  ) {
    setDocuments((current) => {
      const existing = current.some((document) => document.id === targetDocument.id)
      if (!existing) return [...current, { ...targetDocument, versions: [version] }]
      return current.map((document) => document.id === targetDocument.id
        ? { ...document, versions: [version, ...document.versions] }
        : document)
    })
    setUploadTarget(null)
  }

  async function handleRename() {
    if (!renameDocument || !renameTitle.trim()) return
    setRenaming(true)
    try {
      const response = await fetch(`/api/team-documents/${renameDocument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameTitle.trim() }),
      })
      const json = await response.json()
      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Dokument se nepodařilo přejmenovat")
      }
      setDocuments((current) => current.map((document) => document.id === renameDocument.id
        ? { ...document, title: json.data.title }
        : document))
      setRenameDocument(null)
      toast.success("Dokument je přejmenovaný")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokument se nepodařilo přejmenovat")
    } finally {
      setRenaming(false)
    }
  }

  async function handleArchive(documentId: string) {
    try {
      const response = await fetch(`/api/team-documents/${documentId}`, { method: "DELETE" })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? "Dokument se nepodařilo archivovat")
      setDocuments((current) => current.filter((document) => document.id !== documentId))
      toast.success("Dokument je archivovaný")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokument se nepodařilo archivovat")
    }
  }

  const customDocuments = documents.filter((document) => document.doc_type === "other")

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Zvýrazněné dokumenty">
        {FEATURED_TYPES.map((documentType) => {
          const document = documents.find((candidate) => candidate.doc_type === documentType) ?? null
          return (
            <TeamDocumentCard
              key={documentType}
              document={document}
              documentType={documentType}
              featured
              onUpload={() => setUploadTarget({ document, documentType })}
            />
          )
        })}
      </section>

      <section className="space-y-4" aria-labelledby="other-documents-title">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 id="other-documents-title" className="font-heading text-xl font-semibold">
              Další dokumenty
            </h2>
            <p className="text-sm text-muted-foreground">
              Interní pravidla, zápisy a další důležité týmové soubory.
            </p>
          </div>
          <Button
            onClick={() => setUploadTarget({ document: null, documentType: "other" })}
            className="sm:self-start"
          >
            <FolderPlus className="size-4" />
            Přidat dokument
          </Button>
        </div>

        {customDocuments.length ? (
          <div className="divide-y">
            {customDocuments.map((document) => (
              <TeamDocumentCard
                key={document.id}
                document={document}
                documentType="other"
                onUpload={() => setUploadTarget({ document, documentType: "other" })}
                onRename={() => {
                  setRenameTitle(document.title ?? "")
                  setRenameDocument(document)
                }}
                onArchive={() => handleArchive(document.id)}
              />
            ))}
          </div>
        ) : (
          <Empty className="bg-muted/40 py-10">
            <EmptyHeader>
              <EmptyTitle>Zatím žádné další dokumenty</EmptyTitle>
              <EmptyDescription>
              Přidejte první PDF, které má mít tým po ruce.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <Dialog open={uploadTarget !== null} onOpenChange={(open) => !open && setUploadTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {uploadTarget?.document
                ? `Nová verze · ${getTeamDocumentTitle(uploadTarget.document)}`
                : uploadTarget?.documentType === "other"
                  ? "Přidat dokument"
                  : "Nahrát první verzi"}
            </DialogTitle>
            <DialogDescription>
              Každé nahrání vytvoří samostatnou verzi. Starší verze zůstanou dostupné.
            </DialogDescription>
          </DialogHeader>
          {uploadTarget && (
            <DocumentUploadForm
              document={uploadTarget.document}
              documentType={uploadTarget.documentType}
              onSuccess={handleVersionUploaded}
              onCancel={() => setUploadTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={renameDocument !== null} onOpenChange={(open) => !open && setRenameDocument(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Přejmenovat dokument</DialogTitle>
            <DialogDescription>Změna názvu neovlivní uložené verze.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-team-document">Název dokumentu</Label>
              <Input
                id="rename-team-document"
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
                maxLength={120}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameDocument(null)} disabled={renaming}>
                Zrušit
              </Button>
              <Button onClick={handleRename} disabled={renaming || !renameTitle.trim()}>
                Uložit název
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
