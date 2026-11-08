import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { CopyTeamsMessageButton } from "./copy-teams-message-button"

const copyMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock("@/lib/utils/clipboard", () => ({ copyTextToClipboard: copyMock }))

describe("CopyTeamsMessageButton", () => {
  it("copies the announcement with a link to this TS", async () => {
    render(
      <CopyTeamsMessageButton
        sessionId="s1"
        topic="AI v projektech"
        startsAt="2026-11-09T06:35:00Z"
        endsAt="2026-11-09T08:35:00Z"
        facilitatorNames={["Jana Nováková"]}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Zkopírovat zprávu do Teams" }))

    await waitFor(() => expect(copyMock).toHaveBeenCalledTimes(1))
    const message = copyMock.mock.calls[0][0] as string
    expect(message).toContain("příprava na TS „AI v projektech“")
    expect(message).toContain(`${window.location.origin}/ts/s1`)
    expect(message.endsWith("Mějte se fajn\nJana Nováková")).toBe(true)
  })
})
