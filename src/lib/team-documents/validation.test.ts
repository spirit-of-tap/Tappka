import { describe, expect, it } from "vitest"

import {
  validateCreateDocumentInput,
  validateVersionInput,
} from "./validation"

describe("validateCreateDocumentInput", () => {
  it("accepts featured documents without a title", () => {
    expect(validateCreateDocumentInput({ docType: "team_contract" })).toEqual({
      data: { docType: "team_contract", title: null },
    })
  })

  it("trims custom titles and rejects missing titles", () => {
    expect(
      validateCreateDocumentInput({ docType: "other", title: "  Pravidla porad  " }),
    ).toEqual({ data: { docType: "other", title: "Pravidla porad" } })
    expect(validateCreateDocumentInput({ docType: "other", title: "   " })).toEqual({
      error: "Zadejte název dokumentu",
    })
  })

  it("rejects unknown types and titles on featured documents", () => {
    expect(validateCreateDocumentInput({ docType: "minutes" })).toHaveProperty("error")
    expect(
      validateCreateDocumentInput({ docType: "financial_policy", title: "Rozpočet" }),
    ).toHaveProperty("error")
  })
})

describe("validateVersionInput", () => {
  const documentId = "document-1"

  it("normalizes valid version metadata", () => {
    expect(
      validateVersionInput(
        {
          key: "team-document/document-1/version.pdf",
          fileName: " contract.pdf ",
          fileSize: 2048,
          effectiveFrom: "2026-09-01",
          changeNote: "  Nová pravidla  ",
        },
        documentId,
      ),
    ).toEqual({
      data: {
        key: "team-document/document-1/version.pdf",
        fileName: "contract.pdf",
        fileSize: 2048,
        effectiveFrom: "2026-09-01",
        changeNote: "Nová pravidla",
      },
    })
  })

  it("rejects keys outside the document folder", () => {
    expect(
      validateVersionInput(
        {
          key: "team-document/other-document/version.pdf",
          fileName: "contract.pdf",
          fileSize: 2048,
        },
        documentId,
      ),
    ).toHaveProperty("error")
  })

  it("rejects invalid file metadata and dates", () => {
    expect(
      validateVersionInput(
        {
          key: "team-document/document-1/version.pdf",
          fileName: "",
          fileSize: 0,
          effectiveFrom: "1. 9. 2026",
        },
        documentId,
      ),
    ).toHaveProperty("error")
  })

  it("normalizes omitted optional metadata to null", () => {
    expect(
      validateVersionInput(
        {
          key: "team-document/document-1/version.pdf",
          fileName: "contract.pdf",
          fileSize: 2048,
        },
        documentId,
      ),
    ).toMatchObject({
      data: { effectiveFrom: null, changeNote: null },
    })
  })
})
