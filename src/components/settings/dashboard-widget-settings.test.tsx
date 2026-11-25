import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockRefresh = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { DashboardWidgetSettings } from "@/components/settings/dashboard-widget-settings"
import { widgetsForRole } from "@/lib/dashboard/types"

const fetchSpy = vi.spyOn(globalThis, "fetch")
const widgets = widgetsForRole("student")
const allIds = widgets.map((w) => w.id)

beforeEach(() => {
  fetchSpy.mockReset()
  mockRefresh.mockReset()
})

function sentWidgets(): unknown {
  const init = fetchSpy.mock.calls[0]?.[1]
  return JSON.parse(String(init?.body)).widgets
}

describe("DashboardWidgetSettings", () => {
  it("saves the remaining widgets in canonical order when one is turned off", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }))
    const user = userEvent.setup()
    render(<DashboardWidgetSettings widgets={widgets} shown={allIds} />)

    await user.click(screen.getByRole("switch", { name: "Čtení" }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(sentWidgets()).toEqual(allIds.filter((id) => id !== "reading"))
    expect(screen.getByRole("switch", { name: "Čtení" })).not.toBeChecked()
  })

  it("restores everything with Zobrazit vše", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }))
    const user = userEvent.setup()
    render(<DashboardWidgetSettings widgets={widgets} shown={["team-snapshot"]} />)

    await user.click(screen.getByRole("button", { name: "Zobrazit vše" }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(sentWidgets()).toEqual(allIds)
  })

  it("keeps the last visible widget on", () => {
    render(<DashboardWidgetSettings widgets={widgets} shown={["team-snapshot"]} />)
    expect(screen.getByRole("switch", { name: widgets.find((w) => w.id === "team-snapshot")!.label })).toBeDisabled()
  })

  it("rolls back the switch when saving fails", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }))
    const user = userEvent.setup()
    render(<DashboardWidgetSettings widgets={widgets} shown={allIds} />)

    await user.click(screen.getByRole("switch", { name: "Čtení" }))

    await waitFor(() => expect(screen.getByRole("switch", { name: "Čtení" })).toBeChecked())
  })
})
