import { describe, expect, it } from "vitest"

import {
  formatDocumentDate,
  formatDocumentFileSize,
  formatVersionLabel,
} from "./format"
import { getTeamDocumentTitle } from "./types"

describe("team document format helpers", () => {
  it("formats dates in Czech numeric form", () => {
    expect(formatDocumentDate("2026-08-19")).toBe("19. 8. 2026")
  })

  it("formats file sizes with a Czech decimal comma", () => {
    expect(formatDocumentFileSize(512)).toBe("512 B")
    expect(formatDocumentFileSize(2048)).toBe("2 KB")
    expect(formatDocumentFileSize(2.5 * 1024 * 1024)).toBe("2,5 MB")
  })

  it("formats a numbered version label", () => {
    expect(formatVersionLabel(3)).toBe("Verze 3")
  })
})

describe("team document titles", () => {
  it("uses fixed titles for featured document types", () => {
    expect(getTeamDocumentTitle({ doc_type: "team_contract", title: null })).toBe(
      "Týmová smlouva",
    )
    expect(getTeamDocumentTitle({ doc_type: "financial_policy", title: null })).toBe(
      "Finanční směrnice",
    )
  })

  it("uses the supplied custom document title", () => {
    expect(getTeamDocumentTitle({ doc_type: "other", title: "Pravidla porad" })).toBe(
      "Pravidla porad",
    )
  })
})
