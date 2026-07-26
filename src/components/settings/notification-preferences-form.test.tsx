import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form"

const fetchSpy = vi.spyOn(globalThis, "fetch")

beforeEach(() => {
  fetchSpy.mockReset()
  mockRefresh.mockReset()
})

const defaultProps = {
  initialCoachReadEmail: true,
  initialCommentEmail: true,
  initialVoteEmail: false,
}

describe("NotificationPreferencesForm", () => {
  it("renders a switch per notification type with the initial state", () => {
    render(<NotificationPreferencesForm {...defaultProps} />)
    expect(screen.getByRole("switch", { name: "Kouč přečetl tvou esej" })).toBeChecked()
    expect(screen.getByRole("switch", { name: "Nový like na tvou esej" })).not.toBeChecked()
  })

  it("sends a PATCH with only the toggled key on change", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }))
    const user = userEvent.setup()
    render(<NotificationPreferencesForm {...defaultProps} />)

    await user.click(screen.getByRole("switch", { name: "Nový like na tvou esej" }))

    expect(fetchSpy).toHaveBeenCalledWith("/api/profile/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ essay_vote_email: true }),
    })
  })

  it("rolls back the toggle when the request fails", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }))
    const user = userEvent.setup()
    render(<NotificationPreferencesForm {...defaultProps} />)

    const toggle = screen.getByRole("switch", { name: "Nový like na tvou esej" })
    await user.click(toggle)

    expect(toggle).not.toBeChecked()
  })
})
