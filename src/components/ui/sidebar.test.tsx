import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

describe("Sidebar", () => {
  it("keeps the permanent desktop variant viewport-height", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar collapsible="none">Navigation</Sidebar>
      </SidebarProvider>
    )

    expect(container.querySelector('[data-slot="sidebar"]')).toHaveClass("h-svh")
  })

  it("makes the desktop content inset the scroll container", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar collapsible="none">Navigation</Sidebar>
        <SidebarInset>Content</SidebarInset>
      </SidebarProvider>
    )

    expect(container.querySelector('[data-slot="sidebar-inset"]')).toHaveClass(
      "md:min-h-0",
      "md:overflow-y-auto"
    )
    expect(container.querySelector('[data-slot="sidebar-wrapper"]')).toHaveClass(
      "md:h-svh",
      "md:overflow-hidden"
    )
  })
})
