import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { CustomerMeetingDetail } from "./customer-meeting-detail"

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const MEETING = {
  id: "m1",
  profile_id: "p1",
  company: "IKEM",
  contact_person: "David Sibřina",
  position: "Founder of IKEM VRLab",
  objective: "Zjistit, jak funguje zavádění VR do praxe.",
  post_mortem: null,
  team_share: null,
  meeting_at: null,
  removed_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  created_by_profile_id: "p1",
  updated_by_profile_id: "p1",
} as const

describe("CustomerMeetingDetail", () => {
  it("lists the person before the company (person-first everywhere)", () => {
    render(<CustomerMeetingDetail meeting={MEETING} profileId="p1" />)
    const person = screen.getByText("Kontaktní osoba")
    const company = screen.getByText("Společnost")
    // DOCUMENT_POSITION_FOLLOWING = company comes after person in tree order.
    expect(person.compareDocumentPosition(company) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("keeps edit visible but hides destructive action behind the overflow menu", () => {
    render(<CustomerMeetingDetail meeting={MEETING} profileId="p1" />)
    expect(screen.getByRole("button", { name: /Upravit/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Smazat/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Další akce" })).toBeInTheDocument()
  })
})
