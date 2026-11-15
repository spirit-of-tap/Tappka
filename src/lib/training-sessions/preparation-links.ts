import { contentTextFromJson } from "@/lib/essays/content-text"

/** Text left after stripping URLs shorter than this still counts as link-only. */
export const LINK_ONLY_MEANINGFUL_TEXT_MIN_LENGTH = 50

/** Bare URLs typed or pasted as plain text (no link mark). */
const URL_SOURCE = String.raw`(?:https?:\/\/|\bwww\.)[^\s)]+`
const WWW_PREFIX = /^www\./i
/** Only web links are offered as "open the document" — never javascript:, mailto: etc. */
const WEB_URL = /^https?:\/\//i

interface PmNode {
  marks?: Array<{ type?: unknown; attrs?: Record<string, unknown> }>
  content?: unknown
}

function collectLinkHrefs(node: unknown, out: string[]): void {
  if (node === null || typeof node !== "object") return
  const record = node as PmNode
  if (Array.isArray(record.marks)) {
    for (const mark of record.marks) {
      const href = mark.type === "link" ? mark.attrs?.href : undefined
      if (typeof href === "string" && href.trim() !== "") out.push(href.trim())
    }
  }
  if (Array.isArray(record.content)) {
    for (const child of record.content) collectLinkHrefs(child, out)
  }
}

function toWebUrl(raw: string): string | null {
  const url = WWW_PREFIX.test(raw) ? `https://${raw}` : raw
  return WEB_URL.test(url) ? url : null
}

/**
 * First link in the TipTap doc — a link mark's href, otherwise a bare URL in
 * the text. Lets the link-only nudge offer "open the document" so its
 * content can be copied over.
 */
export function findPreparationLink(contentJson: unknown): string | null {
  if (contentJson === null || typeof contentJson !== "object") return null
  const hrefs: string[] = []
  collectLinkHrefs(contentJson, hrefs)
  for (const href of hrefs) {
    const url = toWebUrl(href)
    if (url) return url
  }
  const match = contentTextFromJson(contentJson).match(new RegExp(URL_SOURCE, "i"))
  return match ? toWebUrl(match[0]) : null
}

/**
 * True when the TipTap doc holds (almost) nothing but a link — e.g. a bare
 * Google Docs URL. Such preparations hide the real content outside Tappka,
 * so the editor nudges to paste the content in before saving.
 */
export function isLinkOnlyPreparation(contentJson: unknown): boolean {
  if (contentJson === null || typeof contentJson !== "object") return false
  const text = contentTextFromJson(contentJson)
  if (text === "") return false
  if (findPreparationLink(contentJson) === null) return false

  const withoutUrls = text
    .replace(new RegExp(URL_SOURCE, "gi"), "")
    .replace(/\s+/g, " ")
    .trim()
  return withoutUrls.length < LINK_ONLY_MEANINGFUL_TEXT_MIN_LENGTH
}
