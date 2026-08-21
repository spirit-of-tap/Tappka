import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CustomerMeetingCard } from "./customer-meeting-card"

const NOW = new Date(2026, 4, 15, 12, 0)

function build(
  overrides: {
    company?: string
    contact_person?: string
    meeting_at?: string | null
    post_mortem?: string | null
  } = {},
) {
  return {
    company: "GrowJOB, s.r.o.",
    contact_person: "Kateřina Gonderová",
    meeting_at: "2026-05-13T09:00:00Z",
    post_mortem: "Reflexe vyplněna",
    ...overrides,
  }
}

describe("CustomerMeetingCard", () => {
  it("puts the person first, company and date second", () => {
    render(<CustomerMeetingCard meeting={build()} now={NOW} />)
    const person = screen.getByText("Kateřina Gonderová")
    expect(person).toHaveClass("font-medium")
    expect(screen.getByText("GrowJOB, s.r.o.")).toBeInTheDocument()
    expect(screen.getByText(/13\.\s*5\./)).toBeInTheDocument()
  })

  it("renders initials disc from the contact name", () => {
    render(<CustomerMeetingCard meeting={build()} now={NOW} />)
    expect(screen.getByText("KG")).toBeInTheDocument()
  })

  it("shows no chip when the loop is closed", () => {
    render(<CustomerMeetingCard meeting={build()} now={NOW} />)
    expect(screen.queryByText("Chybí follow-up")).not.toBeInTheDocument()
    expect(screen.queryByText("Naplánováno")).not.toBeInTheDocument()
  })

  it("chips past meetings without post-mortem as missing follow-up", () => {
    render(<CustomerMeetingCard meeting={build({ post_mortem: null })} now={NOW} />)
    expect(screen.getByText("Chybí follow-up")).toBeInTheDocument()
  })

  it("chips future meetings as planned", () => {
    render(
      <CustomerMeetingCard meeting={build({ meeting_at: "2026-06-01T09:00:00Z" })} now={NOW} />,
    )
    expect(screen.getByText("Naplánováno")).toBeInTheDocument()
  })

  it("chips undated meetings as bez data and hides the date", () => {
    render(<CustomerMeetingCard meeting={build({ meeting_at: null })} now={NOW} />)
    expect(screen.getByText("Bez data")).toBeInTheDocument()
    expect(screen.queryByText(/13\.\s*5\./)).not.toBeInTheDocument()
  })

  it("does not leak objective/post-mortem text onto the card", () => {
    render(
      <CustomerMeetingCard meeting={build({ post_mortem: "Tajná dlouhá reflexe…" })} now={NOW} />,
    )
    expect(screen.queryByText(/Tajná dlouhá reflexe/)).not.toBeInTheDocument()
  })
})
