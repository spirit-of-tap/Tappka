import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getWeekRange, shiftWeekRange } from "@/lib/time-tracking/week"

import { formatWeekLabel, resolveWeekParam, toWeekParam } from "./cas-query"
import { WeekNav } from "./week-nav"

const replace = vi.fn()
let search = "team=t1"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/cas/tym",
  useSearchParams: () => new URLSearchParams(search),
}))

// Thursday 24. 9. 2026, 12:00 Prague.
const NOW = new Date("2026-09-24T10:00:00Z")
const CURRENT = getWeekRange(NOW)

beforeEach(() => {
  replace.mockClear()
  search = "team=t1"
})

describe("cas-query helpers", () => {
  it("resolves ?w= to the containing Prague week and falls back on invalid input", () => {
    expect(toWeekParam(resolveWeekParam("2026-09-17", NOW))).toBe("2026-09-14")
    expect(toWeekParam(resolveWeekParam("nonsense", NOW))).toBe("2026-09-21")
    expect(toWeekParam(resolveWeekParam(undefined, NOW))).toBe("2026-09-21")
    expect(toWeekParam(resolveWeekParam("2026-02-30", NOW))).toBe("2026-09-21")
  })

  it("formats week labels within a month, across months and across years", () => {
    expect(formatWeekLabel(CURRENT)).toBe("21.–27. 9. 2026")
    expect(formatWeekLabel(shiftWeekRange(CURRENT, 1))).toBe("28. 9. – 4. 10. 2026")
    expect(formatWeekLabel(getWeekRange(new Date("2025-12-31T12:00:00Z")))).toBe("29. 12. 2025 – 4. 1. 2026")
  })
})

describe("WeekNav", () => {
  it("goes to the previous week keeping other params", async () => {
    const user = userEvent.setup()
    render(<WeekNav week={CURRENT} now={NOW} />)
    expect(screen.getByText("21.–27. 9. 2026")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Další týden" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Tento týden" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Předchozí týden" }))
    expect(replace).toHaveBeenCalledWith("/cas/tym?team=t1&w=2026-09-14", { scroll: false })
  })

  it("returns to the current week by dropping ?w=", async () => {
    const user = userEvent.setup()
    search = "team=t1&w=2026-09-14"
    render(<WeekNav week={shiftWeekRange(CURRENT, -1)} now={NOW} />)

    await user.click(screen.getByRole("button", { name: "Tento týden" }))
    expect(replace).toHaveBeenCalledWith("/cas/tym?team=t1", { scroll: false })
  })
})
