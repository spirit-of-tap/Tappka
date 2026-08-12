import { describe, expect, it } from "vitest"
import { buildSavePayload, fieldsUnchangedSince, mergeIncomingRecord } from "./reflection-merge"

type Field = "what_went_well" | "responsible_person"

function makeRecord(overrides: Partial<Record<Field, string | null>> = {}): Record<Field, string | null> {
  return {
    what_went_well: null,
    responsible_person: null,
    ...overrides,
  }
}

describe("buildSavePayload", () => {
  it("includes only dirty fields", () => {
    const current = makeRecord({ what_went_well: "Skvělý sprint", responsible_person: "Bob" })
    const payload = buildSavePayload(current, new Set<Field>(["what_went_well"]))
    expect(payload).toEqual({ what_went_well: "Skvělý sprint" })
  })

  it("trims whitespace and converts blank values to null", () => {
    const current = makeRecord({ what_went_well: "   " })
    const payload = buildSavePayload(current, new Set<Field>(["what_went_well"]))
    expect(payload.what_went_well).toBeNull()
  })
})

describe("fieldsUnchangedSince", () => {
  it("returns fields whose value did not change", () => {
    const snapshot = makeRecord({ what_went_well: "A", responsible_person: "Bob" })
    const latest = makeRecord({ what_went_well: "A", responsible_person: "Carol" })
    const unchanged = fieldsUnchangedSince(snapshot, latest, ["what_went_well", "responsible_person"] as Field[])
    expect(unchanged).toEqual(["what_went_well"])
  })
})

describe("mergeIncomingRecord", () => {
  const editableFields: Field[] = ["what_went_well", "responsible_person"]

  it("takes the incoming value for fields the local user is not editing", () => {
    const incoming = makeRecord({ responsible_person: "Carol" })
    const local = makeRecord({ responsible_person: "Bob" })
    const { merged, conflicts } = mergeIncomingRecord(incoming, local, editableFields, new Set(), {})
    expect(merged.responsible_person).toBe("Carol")
    expect(conflicts).toEqual([])
  })

  it("protects a field the local user is mid-edit on from being overwritten", () => {
    const incoming = makeRecord({ responsible_person: "Carol from other tab" })
    const local = makeRecord({ what_went_well: "still typing this sentence" })
    const { merged, conflicts } = mergeIncomingRecord(
      incoming,
      local,
      editableFields,
      new Set<Field>(["what_went_well"]),
      { what_went_well: null },
    )
    expect(merged.what_went_well).toBe("still typing this sentence")
    expect(merged.responsible_person).toBe("Carol from other tab")
    expect(conflicts).toEqual([])
  })

  it("flags a conflict when someone else changed the same field the local user is editing", () => {
    const incoming = makeRecord({ what_went_well: "Someone else's rewrite" })
    const local = makeRecord({ what_went_well: "My in-progress edit" })
    const { merged, conflicts } = mergeIncomingRecord(
      incoming,
      local,
      editableFields,
      new Set<Field>(["what_went_well"]),
      { what_went_well: "original baseline text" },
    )
    expect(merged.what_went_well).toBe("My in-progress edit")
    expect(conflicts).toEqual(["what_went_well"])
  })

  it("rolls the baseline forward to the incoming value so a later unrelated broadcast doesn't re-flag the same conflict", () => {
    const dirtyFields = new Set<Field>(["what_went_well"])
    const local = makeRecord({ what_went_well: "My in-progress edit" })

    const first = mergeIncomingRecord(
      makeRecord({ what_went_well: "Someone else's rewrite" }),
      local,
      editableFields,
      dirtyFields,
      { what_went_well: "original baseline text" },
    )
    expect(first.conflicts).toEqual(["what_went_well"])
    expect(first.nextBaselines.what_went_well).toBe("Someone else's rewrite")

    // A later broadcast triggered by an edit to a *different* field still carries
    // the same (already-seen) what_went_well value along, since broadcasts are
    // whole-row. That should not re-report the conflict.
    const second = mergeIncomingRecord(
      makeRecord({ what_went_well: "Someone else's rewrite", responsible_person: "Dana" }),
      local,
      editableFields,
      dirtyFields,
      first.nextBaselines,
    )
    expect(second.conflicts).toEqual([])
    expect(second.merged.what_went_well).toBe("My in-progress edit")
  })
})
