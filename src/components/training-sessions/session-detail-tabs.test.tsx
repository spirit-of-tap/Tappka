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
    render(<SessionDetailTabs panels={{ prehled: <p>Přehled obsah</p>, priprava: <p>Příprava obsah</p> }} />)
    expect(screen.getByRole("tab", { name: "Přehled" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Příprava" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Docházka" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Reflexe" })).not.toBeInTheDocument()
  })

  it("shows all tabs when every panel is provided", () => {
    render(
      <SessionDetailTabs
        panels={{ prehled: <p>A</p>, priprava: <p>B</p>, dochazka: <p>C</p>, reflexe: <p>D</p> }}
      />,
    )
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Přehled", "Příprava", "Docházka", "Reflexe"])
  })

  it("opens the tab from the query string and falls back to the first tab for unavailable ones", () => {
    searchParams = new URLSearchParams("tab=priprava")
    const { unmount } = render(<SessionDetailTabs panels={{ prehled: <p>A</p>, priprava: <p>Příprava obsah</p> }} />)
    expect(screen.getByRole("tab", { name: "Příprava" })).toHaveAttribute("aria-selected", "true")
    unmount()

    searchParams = new URLSearchParams("tab=reflexe")
    render(<SessionDetailTabs panels={{ prehled: <p>A</p>, priprava: <p>B</p> }} />)
    expect(screen.getByRole("tab", { name: "Přehled" })).toHaveAttribute("aria-selected", "true")
  })
})
