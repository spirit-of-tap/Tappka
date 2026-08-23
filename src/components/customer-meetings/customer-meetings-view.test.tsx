import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CustomerMeetingsView } from "./customer-meetings-view"
import type { CustomerMeeting } from "@/lib/customer-meetings/types"

// The create-dialog form imports the Supabase browser client at module scope;
// stub it so rendering the view never initializes it.
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const NOW = new Date(2026, 4, 15, 12, 0)

function makeMeeting(
  overrides: Partial<CustomerMeeting> & Pick<CustomerMeeting, "id" | "company" | "contact_person">,
): CustomerMeeting {
  return {
    profile_id: "p1",
    position: "",
    objective: "",
    post_mortem: null,
    meeting_at: null,
    team_share: null,
    removed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by_profile_id: "p1",
    updated_by_profile_id: "p1",
    ...overrides,
  } as CustomerMeeting
}

const MEETINGS: CustomerMeeting[] = [
  makeMeeting({
    id: "m1",
    company: "GrowJOB, s.r.o.",
    contact_person: "Kateřina Gonderová",
    position: "HR",
    objective: "Zjistit, jak funguje nábor",
    post_mortem: null,
    meeting_at: "2026-05-13T09:00:00Z",
  }),
  makeMeeting({
    id: "m2",
    company: "Czech Hockey, s.r.o.",
    contact_person: "Jiří Šitina",
    position: "Manažer",
    objective: "Know-how o provozu ligy",
    post_mortem: "Splněno",
    meeting_at: "2026-03-02T09:00:00Z",
  }),
]

describe("CustomerMeetingsView", () => {
  it("renders header count and goal progress from the metrics registry", () => {
    render(<CustomerMeetingsView meetings={MEETINGS} profileId="p1" now={NOW} />)
    expect(screen.getByText("Zákaznické schůzky")).toBeInTheDocument()
    expect(screen.getByText("2 schůzky")).toBeInTheDocument()
    // Both fixtures sit inside the Feb–Aug semester relative to NOW.
    expect(screen.getByText("2/10")).toBeInTheDocument()
    expect(screen.getByText("2/60")).toBeInTheDocument()
  })

  it("groups into month sections; empty months are not rendered", () => {
    render(<CustomerMeetingsView meetings={MEETINGS} profileId="p1" now={NOW} />)
    expect(screen.getByText("Květen 2026")).toBeInTheDocument()
    expect(screen.getByText("Březen 2026")).toBeInTheDocument()
    expect(screen.queryByText("Duben 2026")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /2026/ })).not.toBeInTheDocument()
  })

  it("search filters by person, hiding months without hits", async () => {
    const user = userEvent.setup()
    render(<CustomerMeetingsView meetings={MEETINGS} profileId="p1" now={NOW} />)
    await user.type(screen.getByPlaceholderText("Hledat osobu nebo firmu…"), "Šitina")
    expect(screen.getByText("Jiří Šitina")).toBeInTheDocument()
    expect(screen.queryByText("Kateřina Gonderová")).not.toBeInTheDocument()
    expect(screen.queryByText("Květen 2026")).not.toBeInTheDocument()
  })

  it("shows an empty state when nothing matches the search", async () => {
    const user = userEvent.setup()
    render(<CustomerMeetingsView meetings={MEETINGS} profileId="p1" now={NOW} />)
    await user.type(screen.getByPlaceholderText("Hledat osobu nebo firmu…"), "neexistuje")
    expect(screen.getByText(/Nic jsme nenašli/)).toBeInTheDocument()
  })

  it("shows the global empty state without meetings", () => {
    render(<CustomerMeetingsView meetings={[]} profileId="p1" now={NOW} />)
    expect(screen.getByText("Žádné schůzky")).toBeInTheDocument()
  })

  it("offers a thumb-reachable floating create action on mobile", () => {
    render(<CustomerMeetingsView meetings={MEETINGS} profileId="p1" now={NOW} />)
    const fab = screen.getByRole("button", { name: "Nová schůzka" })
    expect(fab.className).toContain("sm:hidden")
    expect(fab).toHaveTextContent("Nová schůzka")
  })
})
