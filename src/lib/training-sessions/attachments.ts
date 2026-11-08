/**
 * Preparation attachments: supporting files only (books, articles, worksheets).
 * The preparation itself is always the written text — these rules are shared by
 * the upload form and the API so both reject the same files with the same copy.
 */

/** MIME type → stored file extension; must stay within the `documents` bucket allow-list. */
export const TS_ATTACHMENT_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const

export type TsAttachmentContentType = keyof typeof TS_ATTACHMENT_TYPES

export const TS_ATTACHMENT_LIMITS = {
  /** Matches the `documents` bucket file_size_limit (25 MiB). */
  maxBytes: 25 * 1024 * 1024,
  maxPerSession: 10,
  labelMax: 120,
  fileNameMax: 255,
} as const

export const TS_ATTACHMENT_STORAGE_PREFIX = "ts-attachment"

export const TS_ATTACHMENT_ACCEPT = [
  ...Object.keys(TS_ATTACHMENT_TYPES),
  ...Object.values(TS_ATTACHMENT_TYPES).map((ext) => `.${ext}`),
  ".jpeg",
].join(",")

export const TS_ATTACHMENT_MESSAGES = {
  looksLikePreparation:
    "Vypadá to, že nahráváš samotnou přípravu. Tu napiš do textu výše, přílohy slouží jen pro podklady. Pokud jde opravdu o podklad, přejmenuj ho podle obsahu.",
  labelRequired: "Popiš, co příloha obsahuje",
  labelTooLong: `Popis může mít nejvýše ${TS_ATTACHMENT_LIMITS.labelMax} znaků`,
  fileNameInvalid: "Neplatný název souboru",
  typeNotAllowed: "Povolené formáty: PDF, Word, Excel, PowerPoint, JPEG, PNG, WebP",
  tooLarge: `Maximální velikost souboru je ${TS_ATTACHMENT_LIMITS.maxBytes / 1024 / 1024} MB`,
  tooMany: `K přípravě lze přidat nejvýše ${TS_ATTACHMENT_LIMITS.maxPerSession} příloh`,
} as const

/**
 * Inflected forms of the noun "příprava" with diacritics stripped. Exact tokens only,
 * so verbs like "připravit" / "připravené" (same letters once stripped) stay allowed.
 */
const PREPARATION_TOKENS: ReadonlySet<string> = new Set([
  "priprava",
  "pripravy",
  "priprave",
  "pripravu",
  "pripravou",
  "priprav",
  "pripravam",
  "pripravach",
  "pripravami",
  "preparation",
])

/** Glued names like "PripravaTS12" still start with the noun. */
const PREPARATION_TOKEN_PREFIXES = ["priprava", "pripravy"] as const

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

/** True when a file name or label names the file as the preparation itself. */
export function mentionsPreparation(value: string): boolean {
  return normalize(value)
    .split(/[^a-z]+/)
    .some(
      (token) =>
        PREPARATION_TOKENS.has(token) || PREPARATION_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix)),
    )
}

export function isAllowedAttachmentType(contentType: string): contentType is TsAttachmentContentType {
  return Object.hasOwn(TS_ATTACHMENT_TYPES, contentType)
}

export interface AttachmentCandidate {
  label: string
  fileName: string
  contentType: string
  fileSize: number
}

/** Returns a Czech error message, or null when the file may be attached. */
export function validateAttachmentCandidate(candidate: AttachmentCandidate): string | null {
  const label = candidate.label.trim()
  const fileName = candidate.fileName.trim()
  if (!label) return TS_ATTACHMENT_MESSAGES.labelRequired
  if (label.length > TS_ATTACHMENT_LIMITS.labelMax) return TS_ATTACHMENT_MESSAGES.labelTooLong
  if (!fileName || fileName.length > TS_ATTACHMENT_LIMITS.fileNameMax) return TS_ATTACHMENT_MESSAGES.fileNameInvalid
  if (mentionsPreparation(label) || mentionsPreparation(fileName)) return TS_ATTACHMENT_MESSAGES.looksLikePreparation
  if (!isAllowedAttachmentType(candidate.contentType)) return TS_ATTACHMENT_MESSAGES.typeNotAllowed
  if (!Number.isFinite(candidate.fileSize) || candidate.fileSize <= 0 || candidate.fileSize > TS_ATTACHMENT_LIMITS.maxBytes) {
    return TS_ATTACHMENT_MESSAGES.tooLarge
  }
  return null
}

export function attachmentKeyPrefix(sessionId: string): string {
  return `${TS_ATTACHMENT_STORAGE_PREFIX}/${sessionId}/`
}
