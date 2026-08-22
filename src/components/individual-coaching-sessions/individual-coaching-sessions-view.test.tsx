import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { IndividualCoachingSessionsView } from "./individual-coaching-sessions-view"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/storage/public-url", () => ({
  getAvatarUrl: (ref: string | null | undefined) => (ref ? `https://example.test/${ref}` : null),
}))

const NOW = new Date(2026, 4, 15, 12, 0)

function makeSession(
  overrides: {
    id?: string
    session_at?: string | null
    key_takeaways?: string | null
    action_steps?: string | null
    external_coach_name?: string | null
    coach_name?: string
  } = {},
) {
  const { coach_name, ...rest } = overrides
  const base = {
    id: "s1",
    profile_id: "p1",
    session_at: "2026-05-12T09:00:00Z",
    key_takeaways:
      "1. Cesta k cíli a konzistence\nHlavní myšlenka: K dosažení cíle vede vícero cest.",
    action_steps: "1. Vytvořit fyzické prostředí.",
    coach_profile_id: null,
    external_coach_name: null,
    removed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by_profile_id: "p1",
    updated_by_profile_id: "p1",
    ...rest,
  }
  return {
    ...base,
    external_coach_name: rest.external_coach_name ?? null,
    // Coach profile only when the fixture names one; otherwise external/none.
    coach: coach_name != null ? { id: "c1", name: coach_name, picture: null } : null,
  } as import("@/lib/individual-coaching-sessions/types").IndividualCoachingSessionWithCoach
}

const SESSIONS = [
  makeSession({ id: "s1", session_at: "2026-05-12T09:00:00Z", coach_name: "Petr Oliver" }),
  makeSession({
    id: "s2",
    session_at: "2026-03-02T09:00:00Z",
    key_takeaways: "Domněnky je super sdílet.",
    action_steps: "Nasdílet myšlenky týmu.",
    external_coach_name: "Ondra Rentál",
  }),
]

function renderView() {
  return render(
    <IndividualCoachingSessionsView
      sessions={SESSIONS}
      profileId="p1"
      coachProfiles={[]}
      now={NOW}
    />,
  )
}

describe("IndividualCoachingSessionsView", () => {
  it("renders header count and semester progress from the metrics registry", () => {
    renderView()
    expect(screen.getByText("Individuální koučování")).toBeInTheDocument()
    expect(screen.getByText("2 sezení")).toBeInTheDocument()
    // Both fixtures sit inside the Feb–Aug semester relative to NOW.
    expect(screen.getByText("2/1")).toBeInTheDocument()
    expect(screen.getByText("2/6")).toBeInTheDocument()
    expect(screen.getByText("za studium")).toBeInTheDocument()
  })

  it("groups into month sections; empty months are not rendered", () => {
    renderView()
    expect(screen.getByText("Květen 2026")).toBeInTheDocument()
    expect(screen.getByText("Březen 2026")).toBeInTheDocument()
    expect(screen.queryByText(/tento měsíc žádné sezení/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Duben 2026/ })).not.toBeInTheDocument()
  })

  it("search filters by coach and content, hiding months without hits", async () => {
    const user = userEvent.setup()
    renderView()
    await user.type(screen.getByPlaceholderText("Hledat kouče nebo obsah…"), "Rentál")
    expect(screen.getByText("Ondra Rentál")).toBeInTheDocument()
    expect(screen.queryByText("Petr Oliver")).not.toBeInTheDocument()
    expect(screen.queryByText("Květen 2026")).not.toBeInTheDocument()
  })

  it("shows an empty state when nothing matches the search", async () => {
    const user = userEvent.setup()
    renderView()
    await user.type(screen.getByPlaceholderText("Hledat kouče nebo obsah…"), "neexistuje")
    expect(screen.getByText(/Nic jsme nenašli/)).toBeInTheDocument()
  })

  it("shows the global empty state without sessions", () => {
    render(
      <IndividualCoachingSessionsView
        sessions={[]}
        profileId="p1"
        coachProfiles={[]}
        now={NOW}
      />,
    )
    expect(screen.getByText("Žádná sezení")).toBeInTheDocument()
  })
})
