"use client"

import { Archive, FileClock, FileText, Pencil, Upload } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  formatDocumentDate,
  formatDocumentFileSize,
  formatVersionLabel,
} from "@/lib/team-documents/format"
import {
  getTeamDocumentTitle,
  type TeamDocumentType,
  type TeamDocumentWithVersions,
} from "@/lib/team-documents/types"
import { cn } from "@/lib/utils"

interface TeamDocumentCardProps {
  document: TeamDocumentWithVersions | null
  documentType: TeamDocumentType
  featured?: boolean
  onUpload: () => void
  onRename?: () => void
  onArchive?: () => void
}

const FEATURED_DESCRIPTIONS: Partial<Record<TeamDocumentType, string>> = {
  team_contract: "Společná pravidla, hodnoty a směřování týmu.",
  financial_policy: "Pravidla finančního řízení a nakládání s penězi.",
}

export function TeamDocumentCard({
  document,
  documentType,
  featured = false,
  onUpload,
  onRename,
  onArchive,
}: TeamDocumentCardProps) {
  const latestVersion = document?.versions[0] ?? null
  const title = document
    ? getTeamDocumentTitle(document)
    : getTeamDocumentTitle({ doc_type: documentType, title: null })

  return (
    <Card className={cn("gap-4 py-5", featured && "bg-accent/40")}>
      <CardHeader className="flex-row items-start justify-between gap-4 px-5">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="font-heading text-lg font-semibold">{title}</h2>
            {FEATURED_DESCRIPTIONS[documentType] && (
              <p className="text-sm text-muted-foreground">
                {FEATURED_DESCRIPTIONS[documentType]}
              </p>
            )}
          </div>
        </div>
        {latestVersion && <Badge variant="secondary">{formatVersionLabel(latestVersion.version_no)}</Badge>}
      </CardHeader>

      <CardContent className="space-y-4 px-5">
        {latestVersion ? (
          <div className="rounded-lg border bg-background/80 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{latestVersion.file_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nahráno {formatDocumentDate(latestVersion.created_at)}
                  {latestVersion.created_by?.name ? ` · ${latestVersion.created_by.name}` : ""}
                  {` · ${formatDocumentFileSize(latestVersion.file_size)}`}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <a
                  href={`/api/team-documents/versions/${latestVersion.id}/open`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Otevřít aktuální verzi"
                >
                  Otevřít
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Zatím není nahraná žádná verze.
          </div>
        )}

        {document && document.versions.length > 1 && (
          <details className="rounded-lg border px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
              <FileClock className="size-4" />
              Historie verzí ({document.versions.length})
            </summary>
            <ul className="mt-3 divide-y" aria-label="Historie verzí">
              {document.versions.map((version) => (
                <li key={version.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{formatVersionLabel(version.version_no)}</p>
                    <p className="truncate text-xs text-muted-foreground">{version.file_name}</p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <a
                      href={`/api/team-documents/versions/${version.id}/open`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Otevřít
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={onUpload} size="sm">
            <Upload className="size-4" />
            {document ? "Nahrát novou verzi" : "Nahrát první verzi"}
          </Button>
          {documentType === "other" && document && onRename && (
            <Button onClick={onRename} variant="outline" size="sm" aria-label="Přejmenovat">
              <Pencil className="size-4" />
              Přejmenovat
            </Button>
          )}
          {documentType === "other" && document && onArchive && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Archivovat">
                  <Archive className="size-4" />
                  Archivovat
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archivovat dokument?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Dokument zmizí z přehledu. Jeho soubory a historie verzí zůstanou uložené.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Zrušit</AlertDialogCancel>
                  <AlertDialogAction onClick={onArchive}>Potvrdit archivaci</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
