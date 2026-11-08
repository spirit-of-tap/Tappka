"use client"

import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { buildTeamsMessage } from "@/lib/training-sessions/teams-message"
import { copyTextToClipboard } from "@/lib/utils/clipboard"

const COPIED_FEEDBACK_MS = 2_000

interface CopyTeamsMessageButtonProps {
  sessionId: string
  topic: string
  startsAt: string
  endsAt: string
  facilitatorNames: string[]
}

export function CopyTeamsMessageButton({ sessionId, topic, startsAt, endsAt, facilitatorNames }: CopyTeamsMessageButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    const message = buildTeamsMessage({
      topic,
      startsAt,
      endsAt,
      sessionUrl: `${window.location.origin}${TS_ROUTES.detail(sessionId)}`,
      facilitatorNames,
    })
    try {
      await copyTextToClipboard(message)
      setCopied(true)
      toast.success("Zpráva zkopírována, stačí ji vložit do Teams")
    } catch {
      toast.error("Zprávu se nepodařilo zkopírovat")
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={() => void copy()} className="self-start bg-background sm:self-auto">
      {copied ? <Check className="size-4 text-success-strong" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      Zkopírovat zprávu do Teams
    </Button>
  )
}
