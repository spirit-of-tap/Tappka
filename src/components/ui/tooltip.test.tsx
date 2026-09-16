import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

describe("Tooltip UI component", () => {
  it("renders with bg-popover and text-popover-foreground classes for high contrast", async () => {
    const user = userEvent.setup()
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button">Hover me</button>
        </TooltipTrigger>
        <TooltipContent data-testid="tooltip-content">
          <p className="font-medium text-foreground">Matyáš Hodek</p>
          <p className="text-xs text-muted-foreground">Zatím neoznačil:a</p>
        </TooltipContent>
      </Tooltip>,
    )

    const trigger = screen.getByRole("button", { name: "Hover me" })
    await user.hover(trigger)

    const content = await screen.findByTestId("tooltip-content")
    expect(content).toBeInTheDocument()
    expect(content.className).toContain("bg-popover")
    expect(content.className).toContain("text-popover-foreground")
    expect(content.className).toContain("border")

    const { within } = await import("@testing-library/react")
    expect(within(content).getAllByText("Matyáš Hodek")[0]).toBeVisible()
    expect(within(content).getAllByText("Zatím neoznačil:a")[0]).toBeVisible()
  })
})
