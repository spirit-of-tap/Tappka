import { describe, expect, it } from "vitest"

import { isCapacityBelowGuests, preparationInputSchema, sessionInputSchema, sessionPatchSchema } from "./validation"

const valid = {
  topic: "AI v projektech",
  description: "",
  startsAt: "2026-10-06T06:00:00.000Z",
  endsAt: "2026-10-06T10:00:00.000Z",
  roomId: null,
  locationNote: " ",
  guestCapacity: 5,
  facilitatorIds: ["3f0c2b1e-0000-4000-8000-000000000001"],
}

describe("sessionInputSchema", () => {
  it("accepts a valid session and normalizes empty text to null", () => {
    const parsed = sessionInputSchema.parse(valid)
    expect(parsed.description).toBeNull()
    expect(parsed.locationNote).toBeNull()
  })
  it("rejects end before start", () => {
    expect(sessionInputSchema.safeParse({ ...valid, endsAt: valid.startsAt }).success).toBe(false)
  })
  it("rejects sessions longer than 12 hours", () => {
    expect(sessionInputSchema.safeParse({ ...valid, endsAt: "2026-10-06T18:01:00.000Z" }).success).toBe(false)
  })
  it("requires at least one facilitator with a custom Czech message", () => {
    const result = sessionInputSchema.safeParse({ ...valid, facilitatorIds: [] })
    expect(result.success).toBe(false)
    const issue = result.error?.issues[0]
    expect(issue?.code).toBe("custom")
    expect(issue?.message).toBe("Vyber aspoň jednu osobu na facilitaci")
    expect(issue?.path).toEqual(["facilitatorIds"])
  })
  it("rejects capacity above 50 and negative", () => {
    expect(sessionInputSchema.safeParse({ ...valid, guestCapacity: 51 }).success).toBe(false)
    expect(sessionInputSchema.safeParse({ ...valid, guestCapacity: -1 }).success).toBe(false)
  })
})

describe("sessionPatchSchema", () => {
  it("validates update duration and accepts cancel/restore", () => {
    expect(sessionPatchSchema.safeParse({ kind: "update", ...valid }).success).toBe(true)
    expect(sessionPatchSchema.safeParse({ kind: "update", ...valid, endsAt: valid.startsAt }).success).toBe(false)
    expect(sessionPatchSchema.safeParse({ kind: "update", ...valid, facilitatorIds: [] }).success).toBe(false)
    expect(sessionPatchSchema.safeParse({ kind: "cancel" }).success).toBe(true)
    expect(sessionPatchSchema.safeParse({ kind: "restore" }).success).toBe(true)
  })
})

describe("preparationInputSchema", () => {
  it("requires a known action", () => {
    expect(preparationInputSchema.safeParse({ contentJson: { type: "doc" }, action: "publish" }).success).toBe(true)
    expect(preparationInputSchema.safeParse({ contentJson: { type: "doc" }, action: "x" }).success).toBe(false)
  })
})

describe("isCapacityBelowGuests", () => {
  it("is true only when the new capacity cannot hold current guests", () => {
    expect(isCapacityBelowGuests(2, 3)).toBe(true)
    expect(isCapacityBelowGuests(3, 3)).toBe(false)
  })
})
