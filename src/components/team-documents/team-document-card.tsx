"use client"

import { Clock, ExternalLink, Landmark, ScrollText, Upload } from "lucide-react"

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

interface TeamDocumentCardProps {
  document: TeamDocumentWithVersions | null
  documentType: TeamDocumentType
  onUpload: () => void
  onViewHistory?: () => void
}

const FEATURED_CONFIG: Record<
  "team_contract" | "financial_policy",
  {
    icon: typeof ScrollText
    description: string
  }
> = {
  team_contract: {
    icon: ScrollText,
    description: "Pravidla spolupráce, hodnoty a fungování týmu.",
  },
  financial_policy: {
    icon: Landmark,
    description: "Pravidla hospodaření a nakládání s rozpočtem.",
  },
}

export function TeamDocumentCard({
  document,
  documentType,
  onUpload,
  onViewHistory,
}: TeamDocumentCardProps) {
  const latestVersion = document?.versions[0] ?? null
  const title = document
    ? getTeamDocumentTitle(document)
    : getTeamDocumentTitle({ doc_type: documentType, title: null })

  const config =
    documentType === "team_contract" || documentType === "financial_policy"
      ? FEATURED_CONFIG[documentType]
      : { icon: ScrollText, description: "" }
  const Icon = config.icon

  return (
    <Card className="gap-0 border bg-card p-0 shadow-sm transition-all hover:shadow-md">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {title}
            </h2>
            {config.description && (
              <p className="line-clamp-1 text-xs text-muted-foreground sm:text-sm">
                {config.description}
              </p>
            )}
          </div>
        </div>

        {latestVersion ? (
          <Badge variant="secondary" className="shrink-0 font-medium">
            {formatVersionLabel(latestVersion.version_no)}
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 text-muted-foreground">
            Nenahráno
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex flex-col justify-between gap-4 p-4 sm:p-5">
        {latestVersion ? (
          <div className="space-y-1 rounded-md bg-muted/40 p-3 text-xs sm:text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-foreground">
                {latestVersion.file_name}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatDocumentFileSize(latestVersion.file_size)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Nahráno {formatDocumentDate(latestVersion.created_at)}
              {latestVersion.created_by?.name ? ` · ${latestVersion.created_by.name}` : ""}
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground sm:text-sm">
            Zatím není nahraná žádná verze.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {latestVersion ? (
              <>
                <Button asChild size="sm">
                  <a
                    href={`/api/team-documents/versions/${latestVersion.id}/open`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Otevřít aktuální verzi ${title}`}
                  >
                    <ExternalLink className="size-3.5" />
                    Otevřít
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={onUpload}>
                  <Upload className="size-3.5" />
                  Nová verze
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={onUpload}>
                <Upload className="size-3.5" />
                Nahrát první verzi
              </Button>
            )}
          </div>

          {document && document.versions.length > 0 && onViewHistory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewHistory}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <Clock className="size-3.5" />
              Historie ({document.versions.length})
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
