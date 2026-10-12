"use client"

import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { contentJsonToMarkdown } from "@/lib/essays/content-markdown"
import { copyTextToClipboard } from "@/lib/utils/clipboard"

const COPIED_FEEDBACK_MS = 2_000

interface CopyPreparationButtonProps {
  topic: string
  contentJson: object
}

/** Copies the preparation as Markdown — people paste it into an AI chat, which keeps the structure. */
export function CopyPreparationButton({ topic, contentJson }: CopyPreparationButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await copyTextToClipboard(`# ${topic}\n\n${contentJsonToMarkdown(contentJson)}\n`)
      setCopied(true)
    } catch {
      toast.error("Přípravu se nepodařilo zkopírovat")
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => void copy()}
      aria-label={copied ? "Příprava zkopírována" : "Kopírovat přípravu"}
      title={copied ? "Zkopírováno" : "Kopírovat přípravu"}
      className="text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="size-4 text-success-strong" aria-hidden /> : <Copy className="size-4" aria-hidden />}
    </Button>
  )
}
