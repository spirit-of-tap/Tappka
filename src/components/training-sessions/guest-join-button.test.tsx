import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GuestJoinButton } from "./guest-join-button"

const SESSION_ID = "00000000-0000-4000-8000-000000000001"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe("GuestJoinButton as facilitator removal", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { guestCount: 0 } }), { status: 200 })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("asks for confirmation naming the person, then removes their cross sign-up", async () => {
    render(
      <GuestJoinButton sessionId={SESSION_ID} joined conflictText={null} removeTarget={{ profileId: "g1", name: "Klára" }} />,
    )
    expect(screen.queryByRole("button", { name: "Odebrat Klára" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Odebrat Klára z crossu" }))
    expect(screen.getByRole("alertdialog", { name: "Odebrat Klára z TS?" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Odebrat" }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith(`/api/training-sessions/${SESSION_ID}/guests`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: "g1" }),
    })
  })

  it("shows a fallback name for an unnamed person", () => {
    render(
      <GuestJoinButton sessionId={SESSION_ID} joined conflictText={null} removeTarget={{ profileId: "g2", name: null }} />,
    )
    expect(screen.getByRole("button", { name: "Odebrat Bez jména z crossu" })).toBeInTheDocument()
  })
})
