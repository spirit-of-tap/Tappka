import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { Tabs, TabsContent, TabsList, TabsTrigger, TabsTriggerCount } from "./tabs"

function renderTabs(variant?: "line" | "segmented") {
  render(
    <Tabs defaultValue="a">
      <TabsList variant={variant}>
        <TabsTrigger value="a">
          Fronta
          <TabsTriggerCount count={12} tone="attention" />
        </TabsTrigger>
        <TabsTrigger value="b">
          Hotovo
          <TabsTriggerCount count={0} />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="a">Obsah A</TabsContent>
      <TabsContent value="b">Obsah B</TabsContent>
    </Tabs>,
  )
}

describe("TabsTriggerCount", () => {
  it("renders a count beside its label", () => {
    renderTabs()

    expect(screen.getByRole("tab", { name: /fronta/i })).toHaveTextContent("12")
  })

  it("renders nothing at zero — an empty list is not news", () => {
    renderTabs()

    expect(screen.getByRole("tab", { name: /hotovo/i })).toHaveTextContent(/^Hotovo$/)
  })
})

describe("TabsList variants", () => {
  it("defaults to the underline bar — section navigation is the common case", () => {
    renderTabs()

    expect(screen.getByRole("tablist")).toHaveAttribute("data-variant", "line")
  })

  it("still offers the segmented track for a genuine either/or toggle", () => {
    renderTabs("segmented")

    expect(screen.getByRole("tablist")).toHaveAttribute("data-variant", "segmented")
  })

  it("never lets a long bar widen its container", () => {
    renderTabs()

    // The overflow contract the sprava tab bar depends on — seven tabs must
    // scroll inside the list rather than push the page sideways.
    expect(screen.getByRole("tablist")).toHaveClass("max-w-full", "overflow-x-auto")
  })
})

describe("Tabs behaviour", () => {
  it("switches panels on click", async () => {
    renderTabs()

    expect(screen.getByText("Obsah A")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("tab", { name: /hotovo/i }))

    expect(screen.getByText("Obsah B")).toBeInTheDocument()
    expect(screen.queryByText("Obsah A")).not.toBeInTheDocument()
  })
})
