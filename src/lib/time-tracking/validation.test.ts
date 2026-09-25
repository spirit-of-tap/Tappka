import { describe, expect, it } from "vitest"

import {
  createEntrySchema,
  createTagSchema,
  isoDateTimeSchema,
  isValidTimeRange,
  listEntriesQuerySchema,
  tagNameSchema,
  timerActionSchema,
  titleSchema,
  updateEntrySchema,
} from "./validation"

const TAG_ID = "0b6f5c1e-8d2a-4c3b-9f4e-1a2b3c4d5e6f"
const PROFILE_ID = "5f0c7a9e-2b1d-4e8f-a6c3-9d8e7f6a5b4c"

const validEntry = {
  direction: "practise",
  tagId: TAG_ID,
  title: "Prodávání párků před ČZU",
  startedAt: "2026-09-24T08:00:00.000Z",
  endedAt: "2026-09-24T09:30:00.000Z",
}

describe("isValidTimeRange", () => {
  it("requires end strictly after start", () => {
    expect(isValidTimeRange("2026-09-24T08:00:00Z", "2026-09-24T08:00:00.001Z")).toBe(true)
    expect(isValidTimeRange("2026-09-24T08:00:00Z", "2026-09-24T08:00:00Z")).toBe(false)
    expect(isValidTimeRange("2026-09-24T08:00:00Z", "2026-09-24T07:00:00Z")).toBe(false)
    expect(isValidTimeRange("nope", "2026-09-24T07:00:00Z")).toBe(false)
  })
})

describe("isoDateTimeSchema", () => {
  it("accepts Z and explicit offsets, with or without fractional seconds", () => {
    expect(isoDateTimeSchema.safeParse("2026-09-21T08:00:00Z").success).toBe(true)
    expect(isoDateTimeSchema.safeParse("2026-09-21T08:00:00+02:00").success).toBe(true)
    expect(isoDateTimeSchema.safeParse("2026-09-21T08:00:00.123Z").success).toBe(true)
  })

  it("rejects a timestamp with no offset, a bare date, and garbage", () => {
    expect(isoDateTimeSchema.safeParse("2026-09-21T08:00:00").success).toBe(false)
    expect(isoDateTimeSchema.safeParse("2026-09-21").success).toBe(false)
    expect(isoDateTimeSchema.safeParse("garbage").success).toBe(false)
  })
})

describe("titleSchema", () => {
  it("trims whitespace and maps an empty result to null", () => {
    expect(titleSchema.parse("  Čtení  ")).toBe("Čtení")
    expect(titleSchema.parse("   ")).toBeNull()
    expect(titleSchema.parse("")).toBeNull()
    expect(titleSchema.parse(null)).toBeNull()
    expect(titleSchema.parse(undefined)).toBeUndefined()
  })

  it("accepts exactly 120 characters after trimming and rejects 121", () => {
    expect(titleSchema.safeParse(`  ${"x".repeat(120)}  `).success).toBe(true)
    expect(titleSchema.safeParse("x".repeat(121)).success).toBe(false)
  })
})

describe("tagNameSchema", () => {
  it("trims and requires 1..40 characters", () => {
    expect(tagNameSchema.parse("  a  ")).toBe("a")
    expect(tagNameSchema.safeParse("   ").success).toBe(false)
    expect(tagNameSchema.safeParse("x".repeat(40)).success).toBe(true)
    expect(tagNameSchema.safeParse("x".repeat(41)).success).toBe(false)
  })
})

describe("createEntrySchema", () => {
  it("accepts a valid entry", () => {
    expect(createEntrySchema.safeParse(validEntry).success).toBe(true)
  })

  it("accepts null or missing tag and title", () => {
    expect(createEntrySchema.safeParse({ ...validEntry, tagId: null, title: null }).success).toBe(true)
    const { tagId: _tag, title: _title, ...minimal } = validEntry
    expect(createEntrySchema.safeParse(minimal).success).toBe(true)
  })

  it("accepts very short entries (no minimum length)", () => {
    expect(
      createEntrySchema.safeParse({ ...validEntry, endedAt: "2026-09-24T08:00:01.000Z" }).success,
    ).toBe(true)
  })

  it("accepts entries across midnight and with offsets", () => {
    expect(
      createEntrySchema.safeParse({
        ...validEntry,
        startedAt: "2026-09-24T23:00:00+02:00",
        endedAt: "2026-09-25T01:00:00+02:00",
      }).success,
    ).toBe(true)
  })

  it("rejects end before or equal to start", () => {
    expect(createEntrySchema.safeParse({ ...validEntry, endedAt: validEntry.startedAt }).success).toBe(false)
    const result = createEntrySchema.safeParse({ ...validEntry, endedAt: "2026-09-24T07:00:00.000Z" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["endedAt"])
  })

  it("rejects unknown direction, long title, bad tag and bad dates", () => {
    expect(createEntrySchema.safeParse({ ...validEntry, direction: "sleeping" }).success).toBe(false)
    expect(createEntrySchema.safeParse({ ...validEntry, title: "x".repeat(121) }).success).toBe(false)
    expect(createEntrySchema.safeParse({ ...validEntry, tagId: "not-a-uuid" }).success).toBe(false)
    expect(createEntrySchema.safeParse({ ...validEntry, startedAt: "2026-09-24 08:00" }).success).toBe(false)
  })

  it("trims the title and turns an empty title into null", () => {
    const trimmed = createEntrySchema.parse({ ...validEntry, title: "  Čtení  " })
    expect(trimmed.title).toBe("Čtení")
    const empty = createEntrySchema.parse({ ...validEntry, title: "   " })
    expect(empty.title).toBeNull()
  })

  it("accepts a 120 character title", () => {
    expect(createEntrySchema.safeParse({ ...validEntry, title: "x".repeat(120) }).success).toBe(true)
  })
})

describe("updateEntrySchema", () => {
  it("accepts partial updates", () => {
    expect(updateEntrySchema.safeParse({ direction: "reading" }).success).toBe(true)
    expect(updateEntrySchema.safeParse({ tagId: null }).success).toBe(true)
    expect(updateEntrySchema.safeParse({ endedAt: "2026-09-24T10:00:00Z" }).success).toBe(true)
  })

  it("rejects an empty patch", () => {
    expect(updateEntrySchema.safeParse({}).success).toBe(false)
  })

  it("rejects an invalid range when both ends are sent", () => {
    expect(
      updateEntrySchema.safeParse({ startedAt: "2026-09-24T10:00:00Z", endedAt: "2026-09-24T09:00:00Z" }).success,
    ).toBe(false)
  })
})

describe("timerActionSchema", () => {
  it("accepts start with direction and optional fields", () => {
    expect(timerActionSchema.safeParse({ action: "start", direction: "training" }).success).toBe(true)
    expect(
      timerActionSchema.safeParse({ action: "start", direction: "reading", tagId: TAG_ID, title: "Kniha" }).success,
    ).toBe(true)
  })

  it("requires a direction to start", () => {
    expect(timerActionSchema.safeParse({ action: "start" }).success).toBe(false)
  })

  it("accepts stop and rejects unknown actions", () => {
    expect(timerActionSchema.safeParse({ action: "stop" }).success).toBe(true)
    expect(timerActionSchema.safeParse({ action: "pause" }).success).toBe(false)
  })
})

describe("createTagSchema", () => {
  it("trims and bounds the name", () => {
    expect(createTagSchema.parse({ name: "  fellaship " }).name).toBe("fellaship")
    expect(createTagSchema.safeParse({ name: "   " }).success).toBe(false)
    expect(createTagSchema.safeParse({ name: "x".repeat(40) }).success).toBe(true)
    expect(createTagSchema.safeParse({ name: "x".repeat(41) }).success).toBe(false)
  })
})

describe("listEntriesQuerySchema", () => {
  it("accepts an empty query", () => {
    expect(listEntriesQuerySchema.safeParse({}).success).toBe(true)
  })

  it("parses comma-separated profile ids", () => {
    const parsed = listEntriesQuerySchema.parse({ profileIds: `${PROFILE_ID}, ${TAG_ID}` })
    expect(parsed.profileIds).toEqual([PROFILE_ID, TAG_ID])
  })

  it("requires both range ends and a valid order", () => {
    expect(listEntriesQuerySchema.safeParse({ from: "2026-09-21T00:00:00Z" }).success).toBe(false)
    expect(
      listEntriesQuerySchema.safeParse({ from: "2026-09-28T00:00:00Z", to: "2026-09-21T00:00:00Z" }).success,
    ).toBe(false)
    expect(
      listEntriesQuerySchema.safeParse({ from: "2026-09-21T00:00:00Z", to: "2026-09-28T00:00:00Z" }).success,
    ).toBe(true)
  })

  it("rejects bad profile ids and directions", () => {
    expect(listEntriesQuerySchema.safeParse({ profileIds: "abc" }).success).toBe(false)
    expect(listEntriesQuerySchema.safeParse({ direction: "x" }).success).toBe(false)
  })
})
