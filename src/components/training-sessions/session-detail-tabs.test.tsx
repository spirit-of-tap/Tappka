import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SessionDetailTabs } from "./session-detail-tabs"

let searchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/ts/s1",
  useSearchParams: () => searchParams,
}))

describe("SessionDetailTabs", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams()
  })

  it("hides Docházka and Reflexe when their panels are absent", () => {
    render(<SessionDetailTabs panels={{ priprava: <p>Příprava obsah</p> }} />)
    expect(screen.getByRole("tab", { name: "Příprava" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Docházka" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Reflexe" })).not.toBeInTheDocument()
  })

  it("shows all tabs when every panel is provided", () => {
    render(
      <SessionDetailTabs
        panels={{ priprava: <p>B</p>, dochazka: <p>C</p>, reflexe: <p>D</p> }}
      />,
    )
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Příprava", "Docházka", "Reflexe"])
  })

  it("opens Příprava by default", () => {
    render(<SessionDetailTabs panels={{ priprava: <p>B</p>, dochazka: <p>C</p>, reflexe: <p>D</p> }} />)
    expect(screen.getByRole("tab", { name: "Příprava" })).toHaveAttribute("aria-selected", "true")
  })

  it("opens the tab from the query string and falls back to Příprava for unknown or unavailable ones", () => {
    searchParams = new URLSearchParams("tab=dochazka")
    const { unmount } = render(<SessionDetailTabs panels={{ priprava: <p>B</p>, dochazka: <p>C</p> }} />)
    expect(screen.getByRole("tab", { name: "Docházka" })).toHaveAttribute("aria-selected", "true")
    unmount()

    for (const tab of ["reflexe", "prehled"]) {
      searchParams = new URLSearchParams(`tab=${tab}`)
      const view = render(<SessionDetailTabs panels={{ priprava: <p>B</p>, dochazka: <p>C</p> }} />)
      expect(screen.getByRole("tab", { name: "Příprava" })).toHaveAttribute("aria-selected", "true")
      view.unmount()
    }
  })
})
