"use client"

import { CheckCircle2, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { TiptapEditor } from "@/components/essays/tiptap-editor"
import { TiptapRenderer } from "@/components/essays/tiptap-renderer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { EMPTY_DOC } from "@/lib/essays/content-text"

interface PreparationPanelProps {
  sessionId: string
  canEdit: boolean
  contentJson: object | null
  publishedAt: string | null
}

type PreparationAction = "draft" | "publish" | "unpublish"

const ACTION_TOASTS: Record<PreparationAction, string> = {
  draft: "Koncept uložen",
  publish: "Příprava je zveřejněná",
  unpublish: "Příprava je zpět v konceptu",
}

const PUBLISHED_DRAFT_TOAST = "Změny uloženy"
const SAVE_ERROR_MESSAGE = "Přípravu se nepodařilo uložit"

export function PreparationPanel({ sessionId, canEdit, contentJson, publishedAt }: PreparationPanelProps) {
  const router = useRouter()
  const [doc, setDoc] = useState<object>(contentJson ?? EMPTY_DOC)
  const [pending, setPending] = useState(false)

  if (!canEdit) {
    if (!contentJson) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText className="size-6 text-muted-foreground" aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Příprava zatím nebyla zveřejněná</EmptyTitle>
            <EmptyDescription>Facilitace týmu přípravu na toto setkání zatím nezveřejnila.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {!publishedAt ? "Koncept, upravovat ho může jen facilitace této TS." : "Zveřejněná příprava na setkání."}
          </p>
          <Badge
            variant="outline"
            className={
              publishedAt
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1"
                : "border-warning/30 bg-warning/10 text-warning-strong"
            }
          >
            {publishedAt ? (
              <>
                <CheckCircle2 className="size-3" aria-hidden />
                Zveřejněno
              </>
            ) : (
              "Koncept"
            )}
          </Badge>
        </div>
        <div className="pt-1">
          <TiptapRenderer content={contentJson} />
        </div>
      </div>
    )
  }

  async function save(action: PreparationAction) {
    setPending(true)
    try {
      const res = await fetch(`/api/training-sessions/${sessionId}/preparation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentJson: doc, action }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(body.error ?? SAVE_ERROR_MESSAGE)
        return
      }
      toast.success(action === "draft" && publishedAt ? PUBLISHED_DRAFT_TOAST : ACTION_TOASTS[action])
      router.refresh()
    } catch {
      toast.error(SAVE_ERROR_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <p className="text-sm text-muted-foreground">
          {publishedAt ? "Příprava je zveřejněná pro všechny týmy." : "Koncept – zatím viditelný pouze pro tvůj tým."}
        </p>
        <Badge
          variant="outline"
          className={
            publishedAt
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1"
              : "border-warning/30 bg-warning/10 text-warning-strong"
          }
        >
          {publishedAt ? (
            <>
              <CheckCircle2 className="size-3" aria-hidden />
              Zveřejněno
            </>
          ) : (
            "Koncept"
          )}
        </Badge>
      </div>

      <TiptapEditor
        initialContent={doc}
        onChange={(json) => setDoc(json)}
        placeholder="Co je potřeba si připravit, přečíst nebo promyslet předem?"
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => void save("draft")}>
          {publishedAt ? "Uložit změny" : "Uložit koncept"}
        </Button>
        {publishedAt ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => void save("unpublish")}>
            Zrušit zveřejnění
          </Button>
        ) : (
          <Button size="sm" disabled={pending} onClick={() => void save("publish")}>
            Zveřejnit přípravu
          </Button>
        )}
      </div>
    </div>
  )
}


