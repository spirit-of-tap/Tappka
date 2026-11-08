import { describe, expect, it } from "vitest"

import {
  TS_ATTACHMENT_LIMITS,
  TS_ATTACHMENT_MESSAGES,
  mentionsPreparation,
  validateAttachmentCandidate,
} from "./attachments"

const PDF = "application/pdf"
const VALID = { label: "Kniha k přečtení", fileName: "atomove-navyky.pdf", contentType: PDF, fileSize: 1024 }

describe("mentionsPreparation", () => {
  it.each([
    "Příprava_TS_12.pdf",
    "priprava.pdf",
    "PRIPRAVA final.docx",
    "TS-12-pripravy",
    "Moje příprava",
    "k přípravě",
    "PripravaTS12.pdf",
    "preparation.pdf",
  ])("flags %s", (value) => {
    expect(mentionsPreparation(value)).toBe(true)
  })

  it.each([
    "Připravené cvičení",
    "Co si připravit",
    "Pracovní list",
    "atomove-navyky.pdf",
    "Prezentace.pptx",
  ])("allows %s", (value) => {
    expect(mentionsPreparation(value)).toBe(false)
  })
})

describe("validateAttachmentCandidate", () => {
  it("accepts a labelled supporting document", () => {
    expect(validateAttachmentCandidate(VALID)).toBeNull()
  })

  it("requires a label", () => {
    expect(validateAttachmentCandidate({ ...VALID, label: "   " })).toBe(TS_ATTACHMENT_MESSAGES.labelRequired)
  })

  it("rejects a file named as the preparation", () => {
    expect(validateAttachmentCandidate({ ...VALID, fileName: "Příprava TS.pdf" })).toBe(
      TS_ATTACHMENT_MESSAGES.looksLikePreparation,
    )
  })

  it("rejects a label naming the file as the preparation", () => {
    expect(validateAttachmentCandidate({ ...VALID, label: "Celá příprava" })).toBe(
      TS_ATTACHMENT_MESSAGES.looksLikePreparation,
    )
  })

  it("rejects unsupported types and oversized files", () => {
    expect(validateAttachmentCandidate({ ...VALID, contentType: "application/zip" })).toBe(
      TS_ATTACHMENT_MESSAGES.typeNotAllowed,
    )
    expect(validateAttachmentCandidate({ ...VALID, fileSize: TS_ATTACHMENT_LIMITS.maxBytes + 1 })).toBe(
      TS_ATTACHMENT_MESSAGES.tooLarge,
    )
  })
})
