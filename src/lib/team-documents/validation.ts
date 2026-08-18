import { MAX_DOCUMENT_SIZE } from "@/lib/storage/validation"
import { TEAM_DOCUMENT_TYPES, type TeamDocumentType } from "./types"

const MAX_DOCUMENT_TITLE_LENGTH = 120
const MAX_FILE_NAME_LENGTH = 255
const MAX_CHANGE_NOTE_LENGTH = 1000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

interface CreateDocumentInput {
  docType: TeamDocumentType
  title: string | null
}

interface VersionInput {
  key: string
  fileName: string
  fileSize: number
  effectiveFrom: string | null
  changeNote: string | null
}

interface ValidationSuccess<T> {
  data: T
}

interface ValidationFailure {
  error: string
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function validateCreateDocumentInput(
  input: unknown,
): ValidationResult<CreateDocumentInput> {
  if (!isRecord(input) || typeof input.docType !== "string") {
    return { error: "Vyberte typ dokumentu" }
  }
  if (!(TEAM_DOCUMENT_TYPES as readonly string[]).includes(input.docType)) {
    return { error: "Neplatný typ dokumentu" }
  }

  const docType = input.docType as TeamDocumentType
  if (docType !== "other") {
    if (input.title !== undefined && input.title !== null) {
      return { error: "Název zvýrazněného dokumentu nelze změnit" }
    }
    return { data: { docType, title: null } }
  }

  const title = typeof input.title === "string" ? input.title.trim() : ""
  if (!title) return { error: "Zadejte název dokumentu" }
  if (title.length > MAX_DOCUMENT_TITLE_LENGTH) {
    return { error: `Název může mít nejvýše ${MAX_DOCUMENT_TITLE_LENGTH} znaků` }
  }

  return { data: { docType, title } }
}

export function validateVersionInput(
  input: unknown,
  documentId: string,
): ValidationResult<VersionInput> {
  if (!isRecord(input)) return { error: "Chybí údaje o verzi" }

  const expectedKeyPrefix = `team-document/${documentId}/`
  if (typeof input.key !== "string" || !input.key.startsWith(expectedKeyPrefix)) {
    return { error: "Neplatný klíč souboru" }
  }

  const fileName = typeof input.fileName === "string" ? input.fileName.trim() : ""
  if (!fileName || fileName.length > MAX_FILE_NAME_LENGTH) {
    return { error: "Neplatný název souboru" }
  }
  if (
    typeof input.fileSize !== "number"
    || !Number.isFinite(input.fileSize)
    || input.fileSize <= 0
    || input.fileSize > MAX_DOCUMENT_SIZE
  ) {
    return { error: "Neplatná velikost souboru" }
  }

  const effectiveFrom = typeof input.effectiveFrom === "string"
    ? input.effectiveFrom.trim()
    : ""
  if (effectiveFrom && !DATE_PATTERN.test(effectiveFrom)) {
    return { error: "Neplatné datum účinnosti" }
  }

  const changeNote = typeof input.changeNote === "string" ? input.changeNote.trim() : ""
  if (changeNote.length > MAX_CHANGE_NOTE_LENGTH) {
    return { error: `Poznámka může mít nejvýše ${MAX_CHANGE_NOTE_LENGTH} znaků` }
  }

  return {
    data: {
      key: input.key,
      fileName,
      fileSize: input.fileSize,
      effectiveFrom: effectiveFrom || null,
      changeNote: changeNote || null,
    },
  }
}
