import { describe, expect, it } from "vitest"

import { isoToLocalInputs, localInputsToIso } from "@/components/time-tracking/local-datetime"

describe("localInputsToIso", () => {
  it("uses the summer offset (CEST)", () => {
    expect(localInputsToIso("2026-09-25", "14:30")).toBe("2026-09-25T14:30:00+02:00")
  })

  it("uses the winter offset (CET)", () => {
    expect(localInputsToIso("2026-01-10", "08:05")).toBe("2026-01-10T08:05:00+01:00")
  })

  it("resolves the offset on DST change days", () => {
    // 2026-03-29: clocks jump 02:00 → 03:00; 2026-10-25: 03:00 → 02:00.
    expect(localInputsToIso("2026-03-29", "01:30")).toBe("2026-03-29T01:30:00+01:00")
    expect(localInputsToIso("2026-03-29", "12:00")).toBe("2026-03-29T12:00:00+02:00")
    expect(localInputsToIso("2026-10-25", "12:00")).toBe("2026-10-25T12:00:00+01:00")
  })

  it("produces the right instant", () => {
    const iso = localInputsToIso("2026-09-25", "00:15")
    expect(iso).not.toBeNull()
    expect(new Date(iso ?? "").toISOString()).toBe("2026-09-24T22:15:00.000Z")
  })

  it("rejects empty and invalid input", () => {
    expect(localInputsToIso("", "10:00")).toBeNull()
    expect(localInputsToIso("2026-09-25", "")).toBeNull()
    expect(localInputsToIso("2026-02-30", "10:00")).toBeNull()
    expect(localInputsToIso("2026-09-25", "24:00")).toBeNull()
  })
})

describe("isoToLocalInputs", () => {
  it("returns the Prague wall clock", () => {
    expect(isoToLocalInputs("2026-09-24T22:15:00Z")).toEqual({ date: "2026-09-25", time: "00:15" })
    expect(isoToLocalInputs(new Date("2026-01-10T07:05:00Z"))).toEqual({ date: "2026-01-10", time: "08:05" })
  })

  it("round-trips with localInputsToIso", () => {
    const { date, time } = isoToLocalInputs("2026-07-01T09:45:00Z")
    expect(Date.parse(localInputsToIso(date, time) ?? "")).toBe(Date.parse("2026-07-01T09:45:00Z"))
  })
})
