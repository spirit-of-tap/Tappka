"use client"

import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TeamMemberAdminActions } from "@/components/komunita/team-member-admin-actions"

const refreshMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe("TeamMemberAdminActions", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    refreshMock.mockClear()
    global.fetch = vi.fn()
  })

  it("removes a member after confirmation", async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true })

    render(
      <TeamMemberAdminActions profileId="p-1" profileName="Jan Novák" mode="remove" />,
    )

    await user.click(screen.getByRole("button", { name: /Odebrat z týmu/ }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText("Odebrat z týmu?")).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: /^Odebrat z týmu$/ }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/team-members",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ profileId: "p-1", action: "remove" }),
        }),
      )
    })
    expect(refreshMock).toHaveBeenCalled()
  })

  it("shows an error toast when removal fails", async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Profil není členem žádného týmu" }),
    })
    const { toast } = await import("sonner")

    render(
      <TeamMemberAdminActions profileId="p-1" profileName="Jan Novák" mode="remove" />,
    )

    await user.click(screen.getByRole("button", { name: /Odebrat z týmu/ }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: /^Odebrat z týmu$/ }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Profil není členem žádného týmu")
    })
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it("restores a former member after confirmation", async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true })

    render(
      <TeamMemberAdminActions profileId="p-1" profileName="Jan Novák" mode="restore" />,
    )

    await user.click(screen.getByRole("button", { name: /Vrátit do týmu/ }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText("Vrátit do týmu?")).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: /^Vrátit do týmu$/ }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/team-members",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ profileId: "p-1", action: "restore" }),
        }),
      )
    })
  })
})
