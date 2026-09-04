import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CustomerMeetingForm } from "./customer-meeting-form"

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

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Společnost/), "GrowJOB, s.r.o.")
  await user.type(screen.getByLabelText(/Kontaktní osoba/), "Kateřina Gonderová")
  await user.type(screen.getByLabelText(/Cíl schůzky/), "Zjistit náborový proces")
}

// jsdom cannot type into datetime-local inputs reliably — set value directly.
function setDate(value: string) {
  fireEvent.change(screen.getByLabelText(/Datum schůzky/), { target: { value } })
}

describe("CustomerMeetingForm — date constraint", () => {
  it("rejects a meeting dated in the future (legacy data) and never writes", async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(
      <CustomerMeetingForm
        profileId="p1"
        initial={{ id: "m1", meeting_at: "2099-01-01T10:00:00Z" }}
        onSuccess={onSuccess}
        onCancel={() => {}}
      />,
    )

    await user.type(screen.getByLabelText(/Společnost/), "GrowJOB, s.r.o.")
    await user.type(screen.getByLabelText(/Kontaktní osoba/), "Kateřina Gonderová")
    await user.type(screen.getByLabelText(/Cíl schůzky/), "Zjistit náborový proces")
    // The future date arrives via `initial` (jsdom cannot type into
    // datetime-local), so this exercises the submit-time guard directly.
    await user.click(screen.getByRole("button", { name: /Uložit změny/ }))

    expect(await screen.findByText("Datum schůzky nemůže být v budoucnu")).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("accepts a past date and submits", async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<CustomerMeetingForm profileId="p1" onSuccess={onSuccess} onCancel={() => {}} />)

    await fillRequiredFields(user)
    setDate("2025-01-01T10:00")
    await user.click(screen.getByRole("button", { name: /Vytvořit schůzku/ }))

    expect(insert).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })
})
