import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { IndividualCoachingSessionForm } from "./individual-coaching-session-form"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const insert = vi.fn()
const update = vi.fn()

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
      getClaims: async () => ({ data: { claims: { sub: "u1" } } }),
    },
    from: () => ({
      insert: (...args: unknown[]) => {
        insert(...args)
        return { select: () => ({ single: async () => ({ data: {}, error: null }) }) }
      },
      update: (...args: unknown[]) => {
        update(...args)
        return { eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }
      },
    }),
  }),
}))

function renderForm(overrides = {}) {
  return render(
    <IndividualCoachingSessionForm
      profileId="p1"
      coachProfiles={[{ id: "coach1", name: "Petr Oliver", picture: null }]}
      onSuccess={vi.fn()}
      onCancel={() => {}}
      {...overrides}
    />,
  )
}

async function pickCoach(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox"))
  await user.click(screen.getByRole("option", { name: /Petr Oliver/ }))
}

// jsdom cannot type into datetime-local inputs reliably — set value directly.
function setDate(value: string) {
  fireEvent.change(screen.getByLabelText(/Datum sezení/), { target: { value } })
}

describe("IndividualCoachingSessionForm — date constraint", () => {
  it("rejects a session dated in the future (legacy data) and never writes", async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(
      <IndividualCoachingSessionForm
        profileId="p1"
        coachProfiles={[{ id: "coach1", name: "Petr Oliver", picture: null }]}
        initial={{ id: "s1", session_at: "2099-01-01T10:00:00Z", coach_profile_id: "coach1" }}
        onSuccess={onSuccess}
        onCancel={() => {}}
      />,
    )

    await user.click(screen.getByRole("button", { name: /Uložit změny/ }))

    expect(await screen.findByText("Datum sezení nemůže být v budoucnu")).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("accepts a past-dated new session and submits", async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    renderForm({ onSuccess })

    await pickCoach(user)
    setDate("2025-01-01T10:00")
    await user.click(screen.getByRole("button", { name: /Vytvořit sezení/ }))

    expect(insert).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })
})
