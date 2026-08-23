import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { IndividualCoachingSessionRow } from "./individual-coaching-session-row"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
// ProfileAvatar resolves picture refs via Supabase storage URL — not available in jsdom.
vi.mock("@/lib/storage/public-url", () => ({
  getAvatarUrl: (ref: string | null | undefined) => (ref ? `https://example.test/${ref}` : null),
}))


function build(
  overrides: {
    id?: string
    session_at?: string | null
    key_takeaways?: string | null
    action_steps?: string | null
    coach_name?: string
    coach_picture?: string | null
  } = {},
) {
  return {
    id: "s1",
    profile_id: "p1",
    session_at: "2026-05-12T09:00:00Z",
    key_takeaways:
      "1. Cesta k cíli a konzistence\nHlavní myšlenka: K dosažení cíle vede vícero cest.",
    action_steps: "1. Vytvořit fyzické prostředí, které podporuje cestu.\n2. Minimalizovat rozptýlení.",
    coach_profile_id: null,
    external_coach_name: null,
    removed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by_profile_id: "p1",
    updated_by_profile_id: "p1",
    ...overrides,
    coach: {
      id: "c1",
      name: overrides.coach_name ?? "Petr Oliver",
      picture: overrides.coach_picture ?? null,
    },
  } as import("@/lib/individual-coaching-sessions/types").IndividualCoachingSessionWithCoach
}

describe("IndividualCoachingSessionRow", () => {
  it("shows coach name, date pill and a one-line preview of takeaways", () => {
    render(<IndividualCoachingSessionRow session={build()} />)
    const name = screen.getByText("Petr Oliver")
    expect(name).toHaveClass("font-medium")
    expect(screen.getByText(/12\.05\./)).toBeInTheDocument()
    expect(screen.getByText(/Cesta k cíli a konzistence/)).toBeInTheDocument()
  })

  it("falls back to previewing action steps when takeaways are empty", () => {
    render(
      <IndividualCoachingSessionRow
        session={build({ key_takeaways: null })}
       
      />,
    )
    expect(screen.getByText(/Vytvořit fyzické prostředí/)).toBeInTheDocument()
  })

  it("expands inline to show full takeaways and action steps on tap", async () => {
    const user = userEvent.setup()
    render(<IndividualCoachingSessionRow session={build()} />)
    expect(screen.queryByText(/Minimalizovat rozptýlení/)).not.toBeInTheDocument()
    await user.click(screen.getByText("Petr Oliver"))
    expect(screen.getByText("Co jsem si odnesl")).toBeInTheDocument()
    expect(screen.getByText("Akční kroky po koučování")).toBeInTheDocument()
    expect(screen.getByText(/Minimalizovat rozptýlení/)).toBeInTheDocument()
  })

  it("chips dated sessions without takeaways as missing notes", () => {
    render(<IndividualCoachingSessionRow session={build({ key_takeaways: null })} />)
    expect(screen.getByText("Chybí poznámky")).toBeInTheDocument()
  })

  it("marks undated sessions as bez data", () => {
    render(<IndividualCoachingSessionRow session={build({ session_at: null })} />)
    expect(screen.getByText("Bez data")).toBeInTheDocument()
  })

  it("keeps destructive delete behind the overflow menu; edit opens dialog", async () => {
    const user = userEvent.setup()
    render(<IndividualCoachingSessionRow session={build()} profileId="p1" />)
    expect(screen.queryByRole("button", { name: /Smazat/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Další akce" }))
    expect(await screen.findByRole("menuitem", { name: /Smazat/ })).toBeInTheDocument()
    // Edit lives in the menu too — nothing else opens the edit dialog directly.
    expect(screen.queryByRole("button", { name: /Upravit/ })).not.toBeInTheDocument()
  })

  it("uses ProfileAvatar when the coach has a picture", () => {
    const { container } = render(
      <IndividualCoachingSessionRow session={build({ coach_picture: "avatars/x.png" })} />,
    )
    expect(container.querySelector("img")).not.toBeNull()
  })
})
