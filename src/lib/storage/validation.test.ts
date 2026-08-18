import { describe, expect, it } from "vitest"
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_SIZE,
  validatePersonalityTestUpload,
  validateTeamDocumentUpload,
} from "./validation"

describe("validatePersonalityTestUpload", () => {
  it("accepts PDF and common image types within the size limit", () => {
    for (const type of ALLOWED_DOCUMENT_TYPES) {
      expect(validatePersonalityTestUpload(type, MAX_DOCUMENT_SIZE)).toBeNull()
    }
  })

  it("rejects unsupported content types", () => {
    expect(validatePersonalityTestUpload("application/zip", 1024)).toMatchObject({
      field: "contentType",
    })
  })

  it("rejects files over the size limit", () => {
    expect(validatePersonalityTestUpload("application/pdf", MAX_DOCUMENT_SIZE + 1)).toMatchObject({
      field: "fileSize",
    })
  })
})

describe("validateTeamDocumentUpload", () => {
  it("accepts PDF files at the size limit", () => {
    expect(validateTeamDocumentUpload("application/pdf", MAX_DOCUMENT_SIZE)).toBeNull()
  })

  it("rejects non-PDF document and image types", () => {
    expect(validateTeamDocumentUpload("image/png", 1024)).toMatchObject({
      field: "contentType",
    })
    expect(
      validateTeamDocumentUpload(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        1024,
      ),
    ).toMatchObject({ field: "contentType" })
  })

  it("rejects empty and oversized files", () => {
    expect(validateTeamDocumentUpload("application/pdf", 0)).toMatchObject({
      field: "fileSize",
    })
    expect(validateTeamDocumentUpload("application/pdf", MAX_DOCUMENT_SIZE + 1)).toMatchObject({
      field: "fileSize",
    })
  })
})
