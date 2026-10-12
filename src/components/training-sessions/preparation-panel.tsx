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

import { CopyPreparationButton } from "./copy-preparation-button"
import { PreparationInProgress } from "./preparation-in-progress"

interface PreparationPanelProps {
  sessionId: string
  topic: string
  canEdit: boolean
  /** Off when the page already shows the copy icon next to its "Příprava" heading. */
  showCopy?: boolean
  /** Before the TS starts a missing preparation is "being written"; afterwards it is just missing. */
  upcoming: boolean
  contentJson: object | null
  publishedAt: string | null
}

const SAVE_SUCCESS_MESSAGE = "Příprava uložena"
const SAVE_ERROR_MESSAGE = "Přípravu se nepodařilo uložit"

export function PreparationPanel({
  sessionId,
  topic,
  canEdit,
  showCopy = true,
  upcoming,
  contentJson,
  publishedAt,
}: PreparationPanelProps) {
  const router = useRouter()
  const [doc, setDoc] = useState<object>(contentJson ?? EMPTY_DOC)
  const [pending, setPending] = useState(false)

  if (!canEdit) {
    if (!publishedAt || !contentJson || contentTextFromJson(contentJson) === "") {
      if (upcoming) {
        return (
          <Empty className="py-8">
            <EmptyHeader>
              <PreparationInProgress />
              <EmptyTitle className="mt-2">Facilitace na přípravě pracuje</EmptyTitle>
              <EmptyDescription>Jakmile bude hotová, objeví se tady.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      }
      return (
        <Empty className="py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText className="size-6 text-muted-foreground" aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Příprava chybí</EmptyTitle>
            <EmptyDescription>K tomuto setkání příprava nevznikla.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }
    if (!showCopy) return <TiptapRenderer content={contentJson} />
    return (
      <div className="relative">
        <div className="absolute right-0 top-0">
          <CopyPreparationButton topic={topic} contentJson={contentJson} />
        </div>
        <TiptapRenderer content={contentJson} />
      </div>
    )
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
