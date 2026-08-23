"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { DocumentHistoryDialog } from "./document-history-dialog"
import { DocumentUploadForm } from "./document-upload-form"
import { TeamDocumentCard } from "./team-document-card"
import { TeamDocumentRow } from "./team-document-row"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog"
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
  const [historyTarget, setHistoryTarget] = useState<TeamDocumentWithVersions | null>(null)
  const [renameDocument, setRenameDocument] = useState<TeamDocumentWithVersions | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<TeamDocumentWithVersions | null>(null)

  function handleVersionUploaded(
    targetDocument: TeamDocumentWithVersions,
    version: TeamDocumentVersionWithCreator,
  ) {
    setDocuments((current) => {
      const existing = current.some((doc) => doc.id === targetDocument.id)
      if (!existing) {
        return [...current, { ...targetDocument, versions: [version] }]
      }
      return current.map((doc) =>
        doc.id === targetDocument.id
          ? { ...doc, versions: [version, ...doc.versions] }
          : doc,
      )
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
      setDocuments((current) =>
        current.map((doc) =>
          doc.id === renameDocument.id ? { ...doc, title: json.data.title } : doc,
        ),
      )
      setRenameDocument(null)
      toast.success("Dokument je přejmenovaný")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokument se nepodařilo přejmenovat")
    } finally {
      setRenaming(false)
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return
    try {
      const response = await fetch(`/api/team-documents/${archiveTarget.id}`, {
        method: "DELETE",
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? "Dokument se nepodařilo archivovat")
      setDocuments((current) => current.filter((doc) => doc.id !== archiveTarget.id))
      setArchiveTarget(null)
      toast.success("Dokument je archivovaný")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dokument se nepodařilo archivovat")
    }
  }

  const customDocuments = documents.filter((doc) => doc.doc_type === "other")

  return (
    <div className="space-y-10">
      {/* Hlavní 2 smlouvy týmu */}
      <section aria-label="Hlavní dokumenty týmu">
        <div className="grid gap-5 md:grid-cols-2">
          {FEATURED_TYPES.map((documentType) => {
            const document = documents.find((candidate) => candidate.doc_type === documentType) ?? null
            return (
              <TeamDocumentCard
                key={documentType}
                document={document}
                documentType={documentType}
                onUpload={() => setUploadTarget({ document, documentType })}
                onViewHistory={document ? () => setHistoryTarget(document) : undefined}
              />
            )
          })}
        </div>
      </section>

      {/* Další dokumenty týmu */}
      <section className="space-y-4" aria-labelledby="other-documents-heading">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="other-documents-heading" className="font-heading text-lg font-bold tracking-tight sm:text-xl">
              Další dokumenty
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Interní pravidla, zápisy a další důležité týmové soubory.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setUploadTarget({ document: null, documentType: "other" })}
          >
            <Plus className="size-4" />
            Přidat dokument
          </Button>
        </div>

        {customDocuments.length > 0 ? (
          <div className="divide-y rounded-xl border bg-card shadow-sm">
            {customDocuments.map((document) => (
              <TeamDocumentRow
                key={document.id}
                document={document}
                onUpload={() => setUploadTarget({ document, documentType: "other" })}
                onViewHistory={() => setHistoryTarget(document)}
                onRename={() => {
                  setRenameTitle(document.title ?? "")
                  setRenameDocument(document)
                }}
                onArchive={() => setArchiveTarget(document)}
              />
            ))}
          </div>
        ) : (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyTitle>Zatím žádné další dokumenty</EmptyTitle>
              <EmptyDescription>
                Přidejte další PDF, které má mít tým kdykoliv po ruce.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      {/* Dialog pro nahrání souboru */}
      <Dialog
        open={uploadTarget !== null}
        onOpenChange={(open) => !open && setUploadTarget(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {uploadTarget?.document
                ? `Nová verze · ${getTeamDocumentTitle(uploadTarget.document)}`
                : uploadTarget?.documentType === "other"
                  ? "Přidat dokument"
                  : `Nahrát ${uploadTarget?.documentType === "team_contract" ? "Team Contract" : "Finanční směrnici"}`}
            </DialogTitle>
            <DialogDescription>
              Každé nahrání vytvoří novou verzi. Starší verze zůstávají v historii.
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

      {/* Dialog pro historii verzí */}
      <DocumentHistoryDialog
        document={historyTarget}
        open={historyTarget !== null}
        onOpenChange={(open) => !open && setHistoryTarget(null)}
        onUploadNewVersion={
          historyTarget
            ? () => {
                setUploadTarget({
                  document: historyTarget,
                  documentType: historyTarget.doc_type,
                })
              }
            : undefined
        }
      />

      {/* Dialog pro přejmenování */}
      <Dialog
        open={renameDocument !== null}
        onOpenChange={(open) => !open && setRenameDocument(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Přejmenovat dokument</DialogTitle>
            <DialogDescription>Změna názvu neovlivní historii verzí.</DialogDescription>
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
              <Button
                variant="outline"
                onClick={() => setRenameDocument(null)}
                disabled={renaming}
              >
                Zrušit
              </Button>
              <Button onClick={handleRename} disabled={renaming || !renameTitle.trim()}>
                Uložit název
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Potvrzení archivace */}
      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivovat dokument?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokument „{archiveTarget ? getTeamDocumentTitle(archiveTarget) : ""}“ zmizí z přehledu. Jeho soubory a historie verzí zůstanou bezpečně uložené.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Potvrdit archivaci
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
