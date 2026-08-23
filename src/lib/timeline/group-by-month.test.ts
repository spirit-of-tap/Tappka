import { describe, expect, it } from "vitest"
import { addMonths, getMonthKey, getMonthLabel, groupByMonth } from "./group-by-month"

const NOW = new Date(2026, 4, 15) // 15 May 2026

interface Row {
  id: string
  at: string | null
}

function row(id: string, at: string | null): Row {
  return { id, at }
}

describe("getMonthKey / getMonthLabel", () => {
  it("formats keys and czech labels", () => {
    expect(getMonthKey("2026-05-03T10:00:00Z")).toBe("2026-05")
    expect(getMonthLabel("2026-05")).toBe("Květen 2026")
    expect(getMonthLabel("2025-12")).toBe("Prosinec 2025")
  })

  it("returns empty key for null", () => {
    expect(getMonthKey(null)).toBe("")
  })
})

describe("addMonths", () => {
  it("crosses year boundaries both directions", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12")
    expect(addMonths("2025-12", 1)).toBe("2026-01")
  })
})

describe("groupByMonth", () => {
  it("groups newest-first from earliest item month through current month, including empty months", () => {
    const { groups } = groupByMonth(
      [row("a", "2026-05-10T09:00:00Z"), row("b", "2026-03-02T09:00:00Z")],
      { getDate: (r) => r.at, now: NOW },
    )
    expect(groups.map((g) => g.key)).toEqual(["2026-05", "2026-04", "2026-03"])
    expect(groups.map((g) => g.items.length)).toEqual([1, 0, 1])
  })

  it("includes future months beyond the current month (planned meetings)", () => {
    const { groups } = groupByMonth([row("a", "2026-07-01T09:00:00Z")], {
      getDate: (r) => r.at,
      now: NOW,
    })
    expect(groups.map((g) => g.key)).toEqual(["2026-07", "2026-06", "2026-05"])
    expect(groups[0].items).toHaveLength(1)
  })

  it("separates undated items", () => {
    const { groups, undated } = groupByMonth([row("a", null)], { getDate: (r) => r.at, now: NOW })
    expect(groups).toEqual([])
    expect(undated).toHaveLength(1)
  })

  it("returns no groups for an empty set", () => {
    const { groups, undated } = groupByMonth<Row>([], { getDate: (r) => r.at, now: NOW })
    expect(groups).toEqual([])
    expect(undated).toEqual([])
  })

  it("routes unparseable dates to undated and terminates", () => {
    const { groups, undated } = groupByMonth([row("a", "not-a-date")], {
      getDate: (r) => r.at,
      now: NOW,
    })
    expect(groups).toEqual([])
    expect(undated).toHaveLength(1)
  })

  it("returns undated items alongside populated groups", () => {
    const { groups, undated } = groupByMonth(
      [row("a", null), row("b", "2026-05-10T09:00:00Z"), row("c", "also-not-a-date")],
      { getDate: (r) => r.at, now: NOW },
    )
    expect(groups.map((g) => g.key)).toEqual(["2026-05"])
    expect(groups[0].items.map((i) => i.id)).toEqual(["b"])
    expect(undated.map((i) => i.id)).toEqual(["a", "c"])
  })

  it("preserves input order among items in the same month (caller pre-sorts)", () => {
    const { groups } = groupByMonth(
      [
        row("latest", "2026-05-03T09:00:00Z"),
        row("earliest", "2026-05-01T09:00:00Z"),
        row("middle", "2026-05-02T09:00:00Z"),
      ],
      { getDate: (r) => r.at, now: NOW },
    )
    expect(groups[0].items.map((i) => i.id)).toEqual(["latest", "earliest", "middle"])
  })
})
