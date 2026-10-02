"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { TiptapEditor } from "@/components/essays/tiptap-editor"
import { TiptapRenderer } from "@/components/essays/tiptap-renderer"
import { Button } from "@/components/ui/button"
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
    if (!contentJson) return <p className="text-sm text-muted-foreground">Příprava zatím nebyla zveřejněná.</p>
    return <TiptapRenderer content={contentJson} />
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
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {publishedAt ? "Zveřejněno, vidí ji všechny týmy." : "Koncept, vidí ho jen tvůj tým."}
      </p>
      <TiptapEditor
        initialContent={doc}
        onChange={(json) => setDoc(json)}
        placeholder="Co je potřeba si připravit?"
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={() => void save("draft")}>
          {publishedAt ? "Uložit změny" : "Uložit koncept"}
        </Button>
        {publishedAt ? (
          <Button variant="outline" disabled={pending} onClick={() => void save("unpublish")}>
            Zrušit zveřejnění
          </Button>
        ) : (
          <Button disabled={pending} onClick={() => void save("publish")}>
            Zveřejnit
          </Button>
        )}
      </div>
    </div>
  )
}
