import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { HelpDialog } from "./help-dialog"

describe("HelpDialog", () => {
  it("opens the explainer behind the ? trigger", async () => {
    const user = userEvent.setup()

    render(
      <HelpDialog question="Co jsou zákaznické schůzky?">
        <div>obsah vysvětlivky</div>
      </HelpDialog>,
    )

    const trigger = screen.getByRole("button", { name: "Co jsou zákaznické schůzky?" })
    expect(trigger).toBeInTheDocument()

    await user.click(trigger)

    expect(await screen.findByRole("dialog", { name: /co jsou zákaznické schůzky/i })).toBeInTheDocument()
    expect(screen.getByText("obsah vysvětlivky")).toBeInTheDocument()
  })
})
