import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TeamCalendarSettings, type TeamCalendarConnection } from "./team-calendar-settings"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const TEAM = { id: "8c0a5e9e-0000-4000-8000-000000000001", name: "Alfa" }
const ROBOT = "tappka-calendar@tappka.iam.gserviceaccount.com"
const CONNECTED: TeamCalendarConnection = {
  calendarId: "alfa@group.calendar.google.com",
  calendarName: "Tým Alfa",
  lastSyncedAt: "2026-11-08T10:00:00Z",
  failures: [],
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

describe("TeamCalendarSettings", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    refresh.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  it("explains sharing with the robot address when not connected", () => {
    render(<TeamCalendarSettings team={TEAM} teams={null} robotEmail={ROBOT} connection={null} />)
    expect(screen.getByText(ROBOT)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Kopírovat/ })).toBeInTheDocument()
    expect(screen.getByText(/Provádět změny událostí/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Propojit" })).toBeInTheDocument()
  })

  it("connects and shows the server's error when sharing is missing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: "Kalendář se nepodařilo najít." }))
    render(<TeamCalendarSettings team={TEAM} teams={null} robotEmail={ROBOT} connection={null} />)
    await userEvent.type(screen.getByLabelText("ID kalendáře"), "alfa@group.calendar.google.com")
    await userEvent.click(screen.getByRole("button", { name: "Propojit" }))

    expect(await screen.findByText("Kalendář se nepodařilo najít.")).toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/training-sessions/calendar")
    expect(JSON.parse(String(init?.body))).toEqual({ teamId: TEAM.id, calendarId: "alfa@group.calendar.google.com" })
    expect(refresh).not.toHaveBeenCalled()
  })

  it("refreshes after a successful connect", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { calendarName: "Tým Alfa" } }))
    render(<TeamCalendarSettings team={TEAM} teams={null} robotEmail={ROBOT} connection={null} />)
    await userEvent.type(screen.getByLabelText("ID kalendáře"), "alfa@group.calendar.google.com")
    await userEvent.click(screen.getByRole("button", { name: "Propojit" }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it("disables connecting when the robot account is not configured", () => {
    render(<TeamCalendarSettings team={TEAM} teams={null} robotEmail={null} connection={null} />)
    expect(screen.getByText(/zatím není na Tappce nastavená/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Propojit" })).toBeDisabled()
  })

  it("shows the connected calendar, failed syncs with retry, and disconnect", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { synced: 1, failed: 0 } }))
    render(
      <TeamCalendarSettings
        team={TEAM}
        teams={null}
        robotEmail={ROBOT}
        connection={{
          ...CONNECTED,
          failures: [{ sessionId: "s1", topic: "Vyjednávání", startsAt: "2026-11-10T08:00:00Z", errorMessage: "Google Kalendář je teď nedostupný." }],
        }}
      />,
    )
    expect(screen.getByText("Tým Alfa")).toBeInTheDocument()
    expect(screen.getByText("Vyjednávání")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Odpojit" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe("/api/training-sessions/calendar/retry")
  })
})
