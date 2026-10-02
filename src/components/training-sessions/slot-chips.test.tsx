import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SlotChips } from "./slot-chips"

describe("SlotChips", () => {
  it("renders a chip per slot and reports the picked one", () => {
    const onPick = vi.fn()
    const slot = { dateKey: "2026-10-06", startsAt: "2026-10-06T06:00:00.000Z", endsAt: "2026-10-06T10:00:00.000Z", roomId: "r1" }
    render(<SlotChips slots={[slot]} rooms={[{ id: "r1", code: "E209", name: "E209" }]} onPick={onPick} />)
    fireEvent.click(screen.getByRole("button", { name: /Úterý 6\. října · 8:00–12:00 · E209/ }))
    expect(onPick).toHaveBeenCalledWith(slot)
  })

  it("renders nothing without slots", () => {
    const { container } = render(<SlotChips slots={[]} rooms={[]} onPick={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
