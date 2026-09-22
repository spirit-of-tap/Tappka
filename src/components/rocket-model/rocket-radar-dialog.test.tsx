import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type {
  RocketCategoryWithItems,
  RocketIndividualState,
  RocketTeamCheck,
} from "@/lib/rocket-model/types"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"
import { RocketRadarDialog } from "./rocket-radar-dialog"

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts")
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children:
        | React.ReactNode
        | ((props: { width: number; height: number }) => React.ReactNode)
    }) => {
      const content =
        typeof children === "function"
          ? children({ width: 500, height: 500 })
          : children
      return (
        <div style={{ width: 500, height: 500 }}>
          {React.isValidElement(content)
            ? React.cloneElement(
                content as React.ReactElement<{
                  width?: number
                  height?: number
                }>,
                { width: 500, height: 500 },
              )
            : content}
        </div>
      )
    },
  }
})

const members: TeamMemberProfile[] = [
  { id: "m1", name: "Alice", picture: null, role: "student" },
  { id: "m2", name: "Bob", picture: null, role: "student" },
]

const categories: RocketCategoryWithItems[] = [
  {
    id: "cat-1",
    code: "Y1",
    title: "Y1 - Individual Learning",
    order_index: 0,
    is_active: true,
    created_at: "",
    updated_at: "",
    items: [
      {
        id: "item-1",
        category_id: "cat-1",
        order_index: 0,
        text_cs: "Item 1",
        is_active: true,
        created_at: "",
        updated_at: "",
      },
      {
        id: "item-2",
        category_id: "cat-1",
        order_index: 1,
        text_cs: "Item 2",
        is_active: true,
        created_at: "",
        updated_at: "",
      },
    ],
  },
]

const states: RocketIndividualState[] = [
  { item_id: "item-1", profile_id: "m1", is_checked: true, created_at: "", updated_at: "" },
  { item_id: "item-1", profile_id: "m2", is_checked: true, created_at: "", updated_at: "" },
]

const teamChecks: RocketTeamCheck[] = [
  { team_id: "t1", item_id: "item-1", is_checked: true, checked_by_profile_id: "m1", created_at: "", updated_at: "" },
]

describe("RocketRadarDialog", () => {
  it("renders when open is true with live sync badge and section stats", () => {
    const onOpenChange = vi.fn()
    render(
      <RocketRadarDialog
        open={true}
        onOpenChange={onOpenChange}
        categories={categories}
        teamMembers={members}
        states={states}
        teamChecks={teamChecks}
      />,
    )

    expect(screen.getByRole("dialog")).toBeVisible()
    expect(screen.getByText("Radarový graf sekcí")).toBeVisible()
    expect(screen.getByText("Živá synchronizace")).toBeVisible()
    expect(screen.getAllByText("Y1")[0]).toBeVisible()
    expect(screen.getByText(/Potvrzeno:/)).toBeVisible()
    expect(screen.getByText(/Průměr:/)).toBeVisible()
  })

  it("does not render dialog content when open is false", () => {
    render(
      <RocketRadarDialog
        open={false}
        onOpenChange={vi.fn()}
        categories={categories}
        teamMembers={members}
        states={states}
        teamChecks={teamChecks}
      />,
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("switches metric filters on user click", async () => {
    const user = userEvent.setup()
    render(
      <RocketRadarDialog
        open={true}
        onOpenChange={vi.fn()}
        categories={categories}
        teamMembers={members}
        states={states}
        teamChecks={teamChecks}
      />,
    )

    const teamOnlyBtn = screen.getByRole("button", { name: "Pouze potvrzeno" })
    await user.click(teamOnlyBtn)

    const allBtn = screen.getByRole("button", { name: "Včetně 100% shody" })
    await user.click(allBtn)
    expect(screen.getByText("Shoda týmu (100 %)")).toBeVisible()
  })

  it("invokes onSelectCategory and closes dialog when a section card is clicked", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSelectCategory = vi.fn()

    render(
      <RocketRadarDialog
        open={true}
        onOpenChange={onOpenChange}
        categories={categories}
        teamMembers={members}
        states={states}
        teamChecks={teamChecks}
        onSelectCategory={onSelectCategory}
      />,
    )

    const sectionBtn = screen.getByRole("button", { name: /Y1/ })
    await user.click(sectionBtn)

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSelectCategory).toHaveBeenCalledWith("cat-1")
  })

  it("toggles between fullscreen and windowed modal", async () => {
    const user = userEvent.setup()
    render(
      <RocketRadarDialog
        open={true}
        onOpenChange={vi.fn()}
        categories={categories}
        teamMembers={members}
        states={states}
        teamChecks={teamChecks}
      />,
    )

    const toggleBtn = screen.getByRole("button", { name: "Zmenšit do okna" })
    expect(toggleBtn).toBeVisible()

    await user.click(toggleBtn)
    expect(
      screen.getByRole("button", { name: "Zvětšit na celou obrazovku" }),
    ).toBeVisible()
  })
})
