import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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
  initialBookSubmittedEmail: false,
  hasBetaAccess: true,
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

  it("optimistically checks the switch, then rolls back on failure", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }))
    render(<NotificationPreferencesForm {...defaultProps} />)
    const toggle = screen.getByRole("switch", { name: "Nový like na tvou esej" })

    fireEvent.click(toggle)
    expect(toggle).toBeChecked() // optimistic update applied synchronously, before the failed fetch resolves

    await waitFor(() => expect(toggle).not.toBeChecked()) // rolled back after the failed PATCH
  })

  it("renders switches disabled and unchecked when the user has no beta access, regardless of initial values", () => {
    render(<NotificationPreferencesForm {...defaultProps} hasBetaAccess={false} />)

    const switches = screen.getAllByRole("switch")
    expect(switches).toHaveLength(4)
    for (const toggle of switches) {
      expect(toggle).not.toBeChecked()
      expect(toggle).toBeDisabled()
    }
  })

  it("shows a beta-access note linking to /beta when the user has no beta access", () => {
    render(<NotificationPreferencesForm {...defaultProps} hasBetaAccess={false} />)

    const link = screen.getByRole("link", { name: /beta/i })
    expect(link).toHaveAttribute("href", "/beta")
  })

  it("does not fire a fetch call when a disabled switch is clicked without beta access", async () => {
    render(<NotificationPreferencesForm {...defaultProps} hasBetaAccess={false} />)
    const toggle = screen.getByRole("switch", { name: "Nový like na tvou esej" })

    fireEvent.click(toggle)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(toggle).not.toBeChecked()
  })
})
