"use client"

import { Clock, ExternalLink, FileText, MoreHorizontal, Pencil, Trash2, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  formatDocumentDate,
  formatDocumentFileSize,
  formatVersionLabel,
} from "@/lib/team-documents/format"
import {
  getTeamDocumentTitle,
  type TeamDocumentWithVersions,
} from "@/lib/team-documents/types"

interface TeamDocumentRowProps {
  document: TeamDocumentWithVersions
  onUpload: () => void
  onViewHistory: () => void
  onRename: () => void
  onArchive: () => void
}

export function TeamDocumentRow({
  document,
  onUpload,
  onViewHistory,
  onRename,
  onArchive,
}: TeamDocumentRowProps) {
  const latestVersion = document.versions[0] ?? null
  const title = getTeamDocumentTitle(document)

  return (
    <div className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-muted/40 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="size-4.5" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-heading text-sm font-semibold sm:text-base">{title}</h3>
            {latestVersion && (
              <Badge variant="secondary" className="text-xs">
                {formatVersionLabel(latestVersion.version_no)}
              </Badge>
            )}
          </div>
          {latestVersion ? (
            <p className="truncate text-xs text-muted-foreground">
              {latestVersion.file_name} · {formatDocumentFileSize(latestVersion.file_size)} · Aktualizováno{" "}
              {formatDocumentDate(latestVersion.created_at)}
              {latestVersion.created_by?.name ? ` · ${latestVersion.created_by.name}` : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Zatím není nahraná žádná verze.</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {latestVersion && (
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <a
              href={`/api/team-documents/versions/${latestVersion.id}/open`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Otevřít ${title}`}
            >
              <ExternalLink className="size-3.5" />
              Otevřít
            </a>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Možnosti pro dokument ${title}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {latestVersion && (
              <DropdownMenuItem asChild className="sm:hidden">
                <a
                  href={`/api/team-documents/versions/${latestVersion.id}/open`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="size-4" />
                  Otevřít PDF
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onUpload}>
              <Upload className="size-4" />
              Nahrát novou verzi
            </DropdownMenuItem>
            {document.versions.length > 0 && (
              <DropdownMenuItem onClick={onViewHistory}>
                <Clock className="size-4" />
                Historie verzí ({document.versions.length})
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="size-4" />
              Přejmenovat
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={onArchive}
            >
              <Trash2 className="size-4" />
              Archivovat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
