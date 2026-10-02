import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SessionForm, type SessionFormValues } from "./session-form"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}))

const initial: SessionFormValues = {
  topic: "AI v projektech",
  description: "",
  date: "2026-10-06",
  startTime: "08:00",
  endTime: "12:00",
  roomId: null,
  locationNote: "",
  guestCapacity: 0,
  facilitatorIds: [],
}

const teamMembers = [{ id: "p1", name: "Anna", picture: null, role: "student" }]

describe("SessionForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("does not submit without a facilitator and shows the error until one is picked", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    render(<SessionForm mode={{ kind: "create" }} initial={initial} rooms={[]} teamMembers={teamMembers} slots={[]} />)

    fireEvent.click(screen.getByRole("button", { name: "Vytvořit TS" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText("Vyber aspoň jednu osobu na facilitaci")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Anna" }))
    expect(screen.queryByText("Vyber aspoň jednu osobu na facilitaci")).not.toBeInTheDocument()
  })
})
