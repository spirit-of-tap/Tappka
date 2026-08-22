import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CustomerMeetingRow } from "./customer-meeting-row"

const NOW = new Date(2026, 4, 15, 12, 0)

function build(
  overrides: {
    id?: string
    company?: string
    contact_person?: string
    meeting_at?: string | null
    post_mortem?: string | null
  } = {},
) {
  return {
    id: "m1",
    company: "GrowJOB, s.r.o.",
    contact_person: "Kateřina Gonderová",
    meeting_at: "2026-05-13T09:00:00Z",
    post_mortem: "Reflexe vyplněna",
    ...overrides,
  }
}

describe("CustomerMeetingRow", () => {
  it("renders person first with company, linking to detail", () => {
    render(<CustomerMeetingRow meeting={build()} now={NOW} />)
    const person = screen.getByText("Kateřina Gonderová")
    expect(person).toHaveClass("font-medium")
    expect(screen.getByText(/GrowJOB/)).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute("href", "/schuzky/m1")
  })

  it("shows the day-of-month in the disc instead of initials", () => {
    render(<CustomerMeetingRow meeting={build()} now={NOW} />)
    // 2026-05-13 → day 13; no initials anywhere on the row.
    expect(screen.getByText("13")).toBeInTheDocument()
    expect(screen.queryByText("KG")).not.toBeInTheDocument()
  })

  it("renders an empty dash disc for undated meetings (rail stays connected)", () => {
    render(<CustomerMeetingRow meeting={build({ meeting_at: null })} now={NOW} />)
    expect(screen.getByText("–")).toBeInTheDocument()
    expect(screen.queryByText(/^1[0-9]$/)).not.toBeInTheDocument()
  })

  it("shows no chip when the loop is closed", () => {
    render(<CustomerMeetingRow meeting={build()} now={NOW} />)
    expect(screen.queryByText("Chybí follow-up")).not.toBeInTheDocument()
    expect(screen.queryByText("Naplánováno")).not.toBeInTheDocument()
  })

  it("chips past meetings without post-mortem as missing follow-up", () => {
    render(<CustomerMeetingRow meeting={build({ post_mortem: null })} now={NOW} />)
    expect(screen.getByText("Chybí follow-up")).toBeInTheDocument()
  })

  it("treats a future-dated entry (should not exist; form constrains it) as an open loop", () => {
    render(
      <CustomerMeetingRow
        meeting={build({ id: "m2", meeting_at: "2027-01-01T09:00:00Z", post_mortem: null })}
        now={NOW}
      />,
    )
    expect(screen.getByText("Chybí follow-up")).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute("href", "/schuzky/m2")
  })

  it("marks undated meetings as bez data", () => {
    render(<CustomerMeetingRow meeting={build({ meeting_at: null })} now={NOW} />)
    expect(screen.getByText("Bez data")).toBeInTheDocument()
  })

  it("can hide the redundant bez-data chip inside the bez-data section", () => {
    render(
      <CustomerMeetingRow meeting={build({ meeting_at: null })} now={NOW} showUndatedChip={false} />,
    )
    expect(screen.queryByText("Bez data")).not.toBeInTheDocument()
  })

  it("does not leak objective/post-mortem text onto the row", () => {
    render(
      <CustomerMeetingRow meeting={build({ post_mortem: "Tajná dlouhá reflexe…" })} now={NOW} />,
    )
    expect(screen.queryByText(/Tajná dlouhá reflexe/)).not.toBeInTheDocument()
  })
})
