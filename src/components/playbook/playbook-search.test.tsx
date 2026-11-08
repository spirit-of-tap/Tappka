import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PlaybookSearch } from "@/components/playbook/playbook-search"

vi.mock("next/navigation", () => ({
  usePathname: () => "/playbook",
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))

describe("PlaybookSearch", () => {
  const renderSearch = () => render(<PlaybookSearch />)
  const getSearchbox = () => screen.getByRole("searchbox", { name: "Hledat v playbooku" })

  it("renders a labeled searchbox", () => {
    renderSearch()
    expect(getSearchbox()).toBeInTheDocument()
  })

  it("shows matching sections as deep links grouped under their chapter title", async () => {
    const user = userEvent.setup()
    renderSearch()

    await user.type(getSearchbox(), "houston")

    const link = await screen.findByRole("link", { name: /Houston calling \(HC\)/ })
    expect(link).toHaveAttribute("href", "/playbook/metriky#houston-calling-hc")
    expect(screen.getByRole("heading", { name: "Metriky" })).toBeInTheDocument()
    expect(link.querySelector("mark")).toHaveTextContent("Houston")
  })

  it("shows the empty state for a query without matches", async () => {
    const user = userEvent.setup()
    renderSearch()

    await user.type(getSearchbox(), "xylofonkvz")

    expect(await screen.findByText("Nic jsme nenašli")).toBeInTheDocument()
    expect(screen.queryAllByRole("link")).toHaveLength(0)
  })

  it("shows neither results nor the empty state for queries shorter than two characters", async () => {
    const user = userEvent.setup()
    renderSearch()

    await user.type(getSearchbox(), "h")

    expect(screen.queryAllByRole("link")).toHaveLength(0)
    expect(screen.queryByText("Nic jsme nenašli")).not.toBeInTheDocument()
  })
})
