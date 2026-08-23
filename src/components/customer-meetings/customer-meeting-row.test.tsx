import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CustomerMeetingRow } from "./customer-meeting-row"

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
    render(<CustomerMeetingRow meeting={build()} />)
    const person = screen.getByText("Kateřina Gonderová")
    expect(person).toHaveClass("font-medium")
    expect(screen.getByText(/GrowJOB/)).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute("href", "/schuzky/m1")
  })

  it("shows initials in the disc", () => {
    render(<CustomerMeetingRow meeting={build()} />)
    expect(screen.getByText("KG")).toBeInTheDocument()
  })

  it("renders date inline after company as 13.05.", () => {
    render(<CustomerMeetingRow meeting={build()} />)
    expect(screen.getByText("13.05.")).toBeInTheDocument()
  })

  it("renders undated meeting with initials disc and no date", () => {
    render(<CustomerMeetingRow meeting={build({ meeting_at: null })} />)
    expect(screen.getByText("KG")).toBeInTheDocument()
    expect(screen.queryByText("13.05.")).not.toBeInTheDocument()
  })

  it("shows no chip when the loop is closed", () => {
    render(<CustomerMeetingRow meeting={build()} />)
    expect(screen.queryByText("Chybí follow-up")).not.toBeInTheDocument()
    expect(screen.queryByText("Naplánováno")).not.toBeInTheDocument()
  })

  it("chips past meetings without post-mortem as missing follow-up", () => {
    render(<CustomerMeetingRow meeting={build({ post_mortem: null })} />)
    expect(screen.getByText("Chybí follow-up")).toBeInTheDocument()
  })

  it("treats a future-dated entry (should not exist; form constrains it) as an open loop", () => {
    render(
      <CustomerMeetingRow
        meeting={build({ id: "m2", meeting_at: "2027-01-01T09:00:00Z", post_mortem: null })}
       
      />,
    )
    expect(screen.getByText("Chybí follow-up")).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute("href", "/schuzky/m2")
  })

  it("marks undated meetings as bez data", () => {
    render(<CustomerMeetingRow meeting={build({ meeting_at: null })} />)
    expect(screen.getByText("Bez data")).toBeInTheDocument()
  })

  it("can hide the redundant bez-data chip inside the bez-data section", () => {
    render(
      <CustomerMeetingRow meeting={build({ meeting_at: null })} showUndatedChip={false} />,
    )
    expect(screen.queryByText("Bez data")).not.toBeInTheDocument()
  })

  it("does not leak objective/post-mortem text onto the row", () => {
    render(
      <CustomerMeetingRow meeting={build({ post_mortem: "Tajná dlouhá reflexe…" })} />,
    )
    expect(screen.queryByText(/Tajná dlouhá reflexe/)).not.toBeInTheDocument()
  })
})
