"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { TiptapEditor } from "@/components/essays/tiptap-editor"
import { Button } from "@/components/ui/button"
import { EMPTY_DOC } from "@/lib/essays/content-text"
import { PRAGUE_TIME_ZONE } from "@/lib/training-sessions/constants"

interface ReflectionPanelProps {
  sessionId: string
  started: boolean
  contentJson: object | null
  lastEditor: string | null
  updatedAt: string | null
}

const UPDATED_FORMAT = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: PRAGUE_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
})

const SAVE_ERROR_MESSAGE = "Reflexi se nepodařilo uložit"

export function ReflectionPanel({ sessionId, started, contentJson, lastEditor, updatedAt }: ReflectionPanelProps) {
  const router = useRouter()
  const [doc, setDoc] = useState<object>(contentJson ?? EMPTY_DOC)
  const [pending, setPending] = useState(false)

  if (!started) return <p className="text-sm text-muted-foreground">Reflexi půjde psát po začátku TS.</p>

  async function save() {
    setPending(true)
    try {
      const res = await fetch(`/api/training-sessions/${sessionId}/reflection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentJson: doc }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(body.error ?? SAVE_ERROR_MESSAGE)
        return
      }
      toast.success("Reflexe uložena")
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
        Co jsme se naučili? Co fungovalo a co bychom příště udělali jinak?
      </p>
      <TiptapEditor initialContent={doc} onChange={(json) => setDoc(json)} placeholder="Týmová reflexe…" />
      {updatedAt && (
        <p className="text-xs text-muted-foreground">
          Naposledy upraveno {UPDATED_FORMAT.format(new Date(updatedAt))}
          {lastEditor ? ` · ${lastEditor}` : ""}
        </p>
      )}
      <Button disabled={pending} onClick={() => void save()}>
        Uložit reflexi
      </Button>
    </div>
  )
}
