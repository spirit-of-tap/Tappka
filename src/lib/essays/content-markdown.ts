/**
 * Converts a TipTap/ProseMirror JSON document to Markdown, so rich text can be
 * pasted into an AI chat with its structure (headings, lists, links) intact.
 * Marks Markdown can't express (underline, highlight, alignment) are dropped.
 */

interface PmMark {
  type: string
  attrs?: Record<string, unknown>
}

interface PmNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: PmMark[]
  content?: PmNode[]
}

const LIST_INDENT = "  "

function asNode(value: unknown): PmNode | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as PmNode) : null
}

function children(node: PmNode): PmNode[] {
  return Array.isArray(node.content) ? node.content.flatMap((c) => asNode(c) ?? []) : []
}

function applyMarks(text: string, marks: PmMark[] | undefined): string {
  if (!marks || text.trim() === "") return text
  let out = text
  for (const mark of marks) {
    switch (mark.type) {
      case "code":
        out = `\`${out}\``
        break
      case "bold":
        out = `**${out}**`
        break
      case "italic":
        out = `*${out}*`
        break
      case "strike":
        out = `~~${out}~~`
        break
    }
  }
  const link = marks.find((m) => m.type === "link")
  const href = typeof link?.attrs?.href === "string" ? link.attrs.href : null
  return href ? `[${out}](${href})` : out
}

function inline(node: PmNode): string {
  return children(node)
    .map((child) => {
      if (child.type === "text") return applyMarks(child.text ?? "", child.marks)
      if (child.type === "hardBreak") return "  \n"
      if (child.type === "image") return image(child)
      return inline(child)
    })
    .join("")
}

function image(node: PmNode): string {
  const src = typeof node.attrs?.src === "string" ? node.attrs.src : ""
  const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : ""
  return src ? `![${alt}](${src})` : ""
}

function prefixLines(text: string, first: string, rest: string): string {
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? first : line === "" ? "" : rest) + line)
    .join("\n")
}

function list(node: PmNode, ordered: boolean): string {
  const start = typeof node.attrs?.start === "number" ? node.attrs.start : 1
  return children(node)
    .map((item, i) => {
      const marker = ordered ? `${start + i}. ` : "- "
      // Tight list items: their paragraphs join with single newlines, nested lists indent under the marker.
      const body = children(item).map(block).filter(Boolean).join("\n")
      return prefixLines(body, marker, LIST_INDENT)
    })
    .join("\n")
}

function block(node: PmNode): string {
  switch (node.type) {
    case "paragraph":
      return inline(node)
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? Math.min(Math.max(node.attrs.level, 1), 6) : 1
      return `${"#".repeat(level)} ${inline(node)}`
    }
    case "bulletList":
      return list(node, false)
    case "orderedList":
      return list(node, true)
    case "blockquote":
      return prefixLines(blocks(node), "> ", "> ")
    case "codeBlock": {
      const language = typeof node.attrs?.language === "string" ? node.attrs.language : ""
      return `\`\`\`${language}\n${children(node).map((c) => c.text ?? "").join("")}\n\`\`\``
    }
    case "horizontalRule":
      return "---"
    case "image":
      return image(node)
    default:
      return blocks(node)
  }
}

function blocks(node: PmNode): string {
  return children(node).map(block).filter((b) => b.trim() !== "").join("\n\n")
}

export function contentJsonToMarkdown(contentJson: unknown): string {
  const doc = asNode(contentJson)
  return doc ? blocks(doc).trim() : ""
}
