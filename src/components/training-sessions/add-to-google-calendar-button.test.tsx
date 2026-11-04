import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AddToGoogleCalendarButton } from "./add-to-google-calendar-button"

describe("AddToGoogleCalendarButton", () => {
  it("renders an external link with the prefilled calendar URL", () => {
    const href = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=TS"
    render(<AddToGoogleCalendarButton href={href} />)

    const link = screen.getByRole("link", { name: "Přidat do Google kalendáře" })

    expect(link).toHaveAttribute("href", href)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })
})
