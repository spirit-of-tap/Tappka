import { describe, expect, it } from "vitest"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"

describe("pluralizeCz", () => {
  it("uses the 'one' form for 1", () => {
    expect(pluralizeCz(1, ["schůzka", "schůzky", "schůzek"])).toBe("schůzka")
  })

  it("uses the 'few' form for 2-4", () => {
    expect(pluralizeCz(2, ["schůzka", "schůzky", "schůzek"])).toBe("schůzky")
    expect(pluralizeCz(4, ["schůzka", "schůzky", "schůzek"])).toBe("schůzky")
  })

  it("uses the 'many' form for 0 and 5+", () => {
    expect(pluralizeCz(0, ["schůzka", "schůzky", "schůzek"])).toBe("schůzek")
    expect(pluralizeCz(5, ["schůzka", "schůzky", "schůzek"])).toBe("schůzek")
  })

  it("uses the 'many' form for 22-24, not 'few' (Czech plural rules key off the absolute value, not the last digit)", () => {
    expect(pluralizeCz(22, ["schůzka", "schůzky", "schůzek"])).toBe("schůzek")
    expect(pluralizeCz(24, ["schůzka", "schůzky", "schůzek"])).toBe("schůzek")
  })
})
