import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { DateKeyRange } from "@/lib/time-tracking/date-range"

import { DateRangePicker } from "./date-range-picker"

// Friday 9. 10. 2026; this week is 5.–11. 10.
const TODAY = "2026-10-09"
const THIS_WEEK: DateKeyRange = { from: "2026-10-05", to: "2026-10-11" }

function setup(value: DateKeyRange = THIS_WEEK) {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<DateRangePicker value={value} onChange={onChange} todayKey={TODAY} />)
  return { onChange, user }
}

/** Day button by its Czech label, e.g. `14. října 2026`. */
function day(label: string) {
  return screen.getByRole("button", { name: new RegExp(`\\b${label.replace(/\./g, "\\.")}`) })
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Období:/ }))
}

describe("DateRangePicker", () => {
  it("shows the preset name with its dates", () => {
    setup()
    expect(screen.getByRole("button", { name: "Období: Tento týden, 5.–11. 10. 2026" })).toBeInTheDocument()
  })

  it("shows dates for a custom range", () => {
    setup({ from: "2026-10-06", to: "2026-10-08" })
    expect(screen.getByRole("button", { name: "Období: 6.–8. 10. 2026" })).toBeInTheDocument()
  })

  it("applies a preset and closes", async () => {
    const { onChange, user } = setup()
    await open(user)
    await user.click(screen.getByRole("button", { name: "Minulý měsíc" }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: "2026-09-01", to: "2026-09-30" })
    expect(screen.queryByRole("button", { name: "Minulý měsíc" })).not.toBeInTheDocument()
  })

  it("marks the active preset", async () => {
    const { user } = setup()
    await open(user)
    expect(screen.getByRole("button", { name: "Tento týden" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Dnes" })).toHaveAttribute("aria-pressed", "false")
  })

  it("picks start then end and applies once", async () => {
    const { onChange, user } = setup()
    await open(user)

    await user.click(day("14. října 2026"))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText("Teď klikni na poslední den.")).toBeInTheDocument()

    await user.click(day("21. října 2026"))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: "2026-10-14", to: "2026-10-21" })
  })

  it("previews the range while hovering after the first click", async () => {
    const { user } = setup()
    await open(user)

    await user.click(day("14. října 2026"))
    await user.hover(day("17. října 2026"))

    expect(day("14. října 2026")).toHaveAttribute("data-range-start", "true")
    expect(day("15. října 2026")).toHaveAttribute("data-range-middle", "true")
    expect(day("17. října 2026")).toHaveAttribute("data-range-end", "true")
    // The previously applied week is no longer highlighted.
    expect(day("6. října 2026")).not.toHaveAttribute("data-range-middle", "true")
  })

  it("an earlier second click moves the start instead of reversing", async () => {
    const { onChange, user } = setup()
    await open(user)

    await user.click(day("21. října 2026"))
    await user.click(day("14. října 2026"))
    expect(onChange).not.toHaveBeenCalled()

    await user.click(day("16. října 2026"))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: "2026-10-14", to: "2026-10-16" })
  })

  it("clicking one day twice selects that day", async () => {
    const { onChange, user } = setup()
    await open(user)

    await user.click(day("2. října 2026"))
    await user.click(day("2. října 2026"))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: "2026-10-02", to: "2026-10-02" })
  })

  it("selects across the two visible months", async () => {
    const { onChange, user } = setup()
    await open(user)

    await user.click(day("28. září 2026"))
    await user.click(day("3. října 2026"))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: "2026-09-28", to: "2026-10-03" })
  })

  it("discards a half-picked range when closed", async () => {
    const { onChange, user } = setup()
    await open(user)
    await user.click(day("14. října 2026"))
    await user.keyboard("{Escape}")

    await open(user)
    expect(screen.getByText("Klikni na první den období.")).toBeInTheDocument()
    await user.click(day("20. října 2026"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("opens on the months of the applied range", async () => {
    const { user } = setup({ from: "2026-03-01", to: "2026-03-31" })
    await open(user)
    expect(screen.getByText("březen 2026")).toBeInTheDocument()
    expect(screen.getByText("únor 2026")).toBeInTheDocument()
  })

  it("shifts by the range length with the arrows and blocks the future", async () => {
    const { onChange, user } = setup()

    expect(screen.getByRole("button", { name: "Další období" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Předchozí období" }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: "2026-09-28", to: "2026-10-04" })
  })

  it("moves months as whole months", async () => {
    const { onChange, user } = setup({ from: "2026-02-01", to: "2026-02-28" })

    await user.click(screen.getByRole("button", { name: "Další období" }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: "2026-03-01", to: "2026-03-31" })
  })
})
