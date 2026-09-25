import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TITLE_PLACEHOLDER } from "@/lib/time-tracking/constants"

import { StartTimerSheet } from "./start-timer-sheet"

const start = vi.fn<(payload: unknown) => Promise<boolean>>()
const toastSuccess = vi.fn()

vi.mock("./timer-provider", () => ({
  useTimer: () => ({ start, isPending: false }),
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: (...args: unknown[]) => toastSuccess(...args), error: vi.fn() }),
}))

function renderSheet() {
  const onOpenChange = vi.fn()
  render(<StartTimerSheet open onOpenChange={onOpenChange} />)
  return { onOpenChange }
}

describe("StartTimerSheet", () => {
  beforeEach(() => {
    start.mockReset()
    start.mockResolvedValue(true)
    toastSuccess.mockReset()
  })

  it("shows the title placeholder and a length limit", () => {
    renderSheet()
    const input = screen.getByPlaceholderText(TITLE_PLACEHOLDER)
    expect(input).toHaveAttribute("maxLength", "120")
  })

  it("blocks submit until a direction is chosen", async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.click(screen.getByRole("button", { name: "Spustit" }))

    expect(start).not.toHaveBeenCalled()
    expect(await screen.findByRole("alert")).toHaveTextContent("Vyber směr")
  })

  it("starts the timer with the chosen direction and title, then closes", async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderSheet()

    await user.click(screen.getByRole("radio", { name: "Reading" }))
    await user.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), "Lean Startup")
    await user.click(screen.getByRole("button", { name: "Spustit" }))

    await waitFor(() =>
      expect(start).toHaveBeenCalledWith({ direction: "reading", tagId: null, title: "Lean Startup" }),
    )
    expect(toastSuccess).toHaveBeenCalledWith("Časomíra běží")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("submits on Ctrl+Enter", async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.click(screen.getByRole("radio", { name: "Training" }))
    await user.click(screen.getByPlaceholderText(TITLE_PLACEHOLDER))
    await user.keyboard("{Control>}{Enter}{/Control}")

    await waitFor(() => expect(start).toHaveBeenCalledWith({ direction: "training", tagId: null, title: null }))
  })

  it("keeps the sheet open when starting fails", async () => {
    start.mockResolvedValue(false)
    const user = userEvent.setup()
    const { onOpenChange } = renderSheet()

    await user.click(screen.getByRole("radio", { name: "Practise" }))
    await user.click(screen.getByRole("button", { name: "Spustit" }))

    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })
})
