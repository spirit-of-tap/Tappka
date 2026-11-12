import { generateHTML } from "@tiptap/html"

import { cn } from "@/lib/utils"
import { normalizeContentJson } from "@/lib/essays/content-text"
import { createTiptapExtensions } from "@/lib/essays/tiptap-extensions"

interface TiptapRendererProps {
  content: object
  className?: string
}

export function TiptapRenderer({ content, className }: TiptapRendererProps) {
  // Last line of defense for legacy rows (e.g. `{}` from title-only saves):
  // normalize so generateHTML never throws on an invalid doc.
  const html = generateHTML(normalizeContentJson(content), createTiptapExtensions())

  return (
    <div
      className={cn("tiptap-content max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
