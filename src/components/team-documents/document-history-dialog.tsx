"use client"

import { Clock, ExternalLink, FileText, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog"
import {
  formatDocumentDate,
  formatDocumentFileSize,
  formatVersionLabel,
} from "@/lib/team-documents/format"
import {
  getTeamDocumentTitle,
  type TeamDocumentWithVersions,
} from "@/lib/team-documents/types"

interface DocumentHistoryDialogProps {
  document: TeamDocumentWithVersions | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadNewVersion?: () => void
}

export function DocumentHistoryDialog({
  document,
  open,
  onOpenChange,
  onUploadNewVersion,
}: DocumentHistoryDialogProps) {
  if (!document) return null

  const title = getTeamDocumentTitle(document)
  const versions = document.versions ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-muted-foreground" />
            <DialogTitle>Historie verzí · {title}</DialogTitle>
          </div>
          <DialogDescription>
            {versions.length === 1
              ? "K dispozici je 1 verze dokumentu."
              : `K dispozici je ${versions.length} verzí dokumentu (od nejnovější po nejstarší).`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {versions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Zatím není nahraná žádná verze.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {versions.map((version, index) => {
                const isLatest = index === 0
                return (
                  <div
                    key={version.id}
                    className={`flex flex-col gap-3 p-4 text-sm transition-colors sm:flex-row sm:items-start sm:justify-between ${
                      isLatest ? "bg-muted/30" : ""
                    }`}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {formatVersionLabel(version.version_no)}
                        </span>
                        {isLatest && (
                          <Badge variant="secondary" className="text-xs">
                            Aktuální
                          </Badge>
                        )}
                        {version.effective_from && (
                          <span className="text-xs text-muted-foreground">
                            · Účinnost od {formatDocumentDate(version.effective_from)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText className="size-3.5 shrink-0" />
                        <span className="truncate font-medium text-foreground">
                          {version.file_name}
                        </span>
                        <span>·</span>
                        <span>{formatDocumentFileSize(version.file_size)}</span>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Nahráno {formatDocumentDate(version.created_at)}
                        {version.created_by?.name ? ` · ${version.created_by.name}` : ""}
                      </p>

                      {version.change_note && (
                        <div className="mt-1 rounded bg-muted/60 px-2.5 py-1.5 text-xs text-foreground">
                          <span className="font-medium text-muted-foreground">Změny: </span>
                          {version.change_note}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
                      <Button asChild size="sm" variant={isLatest ? "default" : "outline"}>
                        <a
                          href={`/api/team-documents/versions/${version.id}/open`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="size-3.5" />
                          Otevřít
                        </a>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {onUploadNewVersion && (
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  onUploadNewVersion()
                }}
              >
                <Upload className="size-4" />
                Nahrát novou verzi
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
