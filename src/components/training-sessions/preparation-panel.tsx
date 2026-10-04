"use client"

import { FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { TiptapEditor } from "@/components/essays/tiptap-editor"
import { TiptapRenderer } from "@/components/essays/tiptap-renderer"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { contentTextFromJson, EMPTY_DOC } from "@/lib/essays/content-text"

interface PreparationPanelProps {
  sessionId: string
  canEdit: boolean
  contentJson: object | null
  publishedAt: string | null
}

const SAVE_SUCCESS_MESSAGE = "Příprava uložena"
const SAVE_ERROR_MESSAGE = "Přípravu se nepodařilo uložit"

export function PreparationPanel({ sessionId, canEdit, contentJson, publishedAt }: PreparationPanelProps) {
  const router = useRouter()
  const [doc, setDoc] = useState<object>(contentJson ?? EMPTY_DOC)
  const [pending, setPending] = useState(false)

  if (!canEdit) {
    if (!publishedAt || !contentJson || contentTextFromJson(contentJson) === "") {
      return (
        <Empty className="py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText className="size-6 text-muted-foreground" aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Příprava zatím chybí</EmptyTitle>
            <EmptyDescription>Facilitace přípravu na toto setkání zatím nenapsala.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }
    return <TiptapRenderer content={contentJson} />
  }

  async function save() {
    setPending(true)
    try {
      const res = await fetch(`/api/training-sessions/${sessionId}/preparation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentJson: doc }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(body.error ?? SAVE_ERROR_MESSAGE)
        return
      }
      toast.success(SAVE_SUCCESS_MESSAGE)
      router.refresh()
    } catch {
      toast.error(SAVE_ERROR_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <TiptapEditor
        initialContent={doc}
        onChange={(json) => setDoc(json)}
        placeholder="Co je potřeba si připravit, přečíst nebo promyslet předem?"
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Uloženou přípravu uvidí všichni, kdo si TS otevřou.</p>
        <Button size="sm" disabled={pending} onClick={() => void save()} className="self-start sm:self-auto">
          Uložit
        </Button>
      </div>
    </div>
  )
}
