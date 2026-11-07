import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { PlaybookSidebar } from "@/components/playbook/playbook-sidebar"
import { PLAYBOOK_CHAPTERS } from "@/lib/playbook/content"

const pathname: { current: string } = { current: "/playbook" }

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))

describe("PlaybookSidebar", () => {
  it("links to every chapter", () => {
    pathname.current = "/playbook"
    render(<PlaybookSidebar />)

    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(PLAYBOOK_CHAPTERS.length)
    for (const chapter of PLAYBOOK_CHAPTERS) {
      expect(screen.getByRole("link", { name: chapter.title })).toHaveAttribute(
        "href",
        `/playbook/${chapter.slug}`,
      )
    }
  })

  it("marks the current chapter with aria-current and leaves the others unmarked", () => {
    pathname.current = "/playbook/metriky"
    render(<PlaybookSidebar />)

    expect(screen.getByRole("link", { name: "Metriky" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Slovník TAP" })).not.toHaveAttribute("aria-current")
  })

  it("keeps all chapters unmarked on the playbook home", () => {
    pathname.current = "/playbook"
    render(<PlaybookSidebar />)

    for (const chapter of PLAYBOOK_CHAPTERS) {
      expect(screen.getByRole("link", { name: chapter.title })).not.toHaveAttribute("aria-current")
    }
  })

  it("renders the mobile chapters toggle", () => {
    pathname.current = "/playbook"
    render(<PlaybookSidebar />)

    expect(screen.getByRole("button", { name: "Kapitoly" })).toBeInTheDocument()
  })
})
