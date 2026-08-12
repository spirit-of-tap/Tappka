import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { PageShell } from "@/components/ui/page-shell"

describe("PageShell", () => {
  it("applies horizontal padding by default so content never touches the viewport edge", () => {
    render(<PageShell><p>content</p></PageShell>)
    expect(screen.getByText("content").parentElement).toHaveClass("px-3", "sm:px-6")
  })

  it("applies the requested max-width variant", () => {
    render(<PageShell size="narrow"><p>content</p></PageShell>)
    expect(screen.getByText("content").parentElement).toHaveClass("max-w-2xl")
  })
})
