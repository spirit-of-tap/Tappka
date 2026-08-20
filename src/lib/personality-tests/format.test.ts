import { describe, expect, it } from "vitest"
import { formatTestDate, formatFileSize } from "./format"
import { getTestTypeLabel } from "./types"

describe("personality test format helpers", () => {
  it("formats a date as day. month. year", () => {
    expect(formatTestDate("2026-03-12")).toBe("12. 3. 2026")
  })

  it("formats file sizes in B, KB and MB with a Czech decimal comma", () => {
    expect(formatFileSize(512)).toBe("512 B")
    expect(formatFileSize(2048)).toBe("2 KB")
    expect(formatFileSize(2 * 1024 * 1024 + 512 * 1024)).toBe("2,5 MB")
  })
})

describe("personality test type labels", () => {
  it("labels known types from the enum", () => {
    expect(getTestTypeLabel({ test_type: "mbti", test_type_other: null })).toBe("MBTI")
    expect(getTestTypeLabel({ test_type: "disc", test_type_other: null })).toBe("DISC")
  })

  it("uses the custom name for other", () => {
    expect(
      getTestTypeLabel({ test_type: "other", test_type_other: "Hogan Assessment" }),
    ).toBe("Hogan Assessment")
  })
})
