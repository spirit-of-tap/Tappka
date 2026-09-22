import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type {
  RocketCategoryWithItems,
  RocketIndividualState,
  RocketTeamCheck,
} from "@/lib/rocket-model/types"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"
import { RocketPresentationDialog } from "./rocket-presentation-dialog"

const members: TeamMemberProfile[] = [
  { id: "m1", name: "Alice", picture: null, role: "student" },
  { id: "m2", name: "Bob", picture: null, role: "student" },
]

const categories: RocketCategoryWithItems[] = [
  {
    id: "cat-1",
    code: "C1",
    title: "Kategorie 1",
    order_index: 0,
    is_active: true,
    created_at: "",
    updated_at: "",
    items: [
      {
        id: "item-1",
        category_id: "cat-1",
        order_index: 0,
        text_cs: "První položka prezentace",
        is_active: true,
        created_at: "",
        updated_at: "",
      },
      {
        id: "item-2",
        category_id: "cat-1",
        order_index: 1,
        text_cs: "Druhá položka prezentace",
        is_active: true,
        created_at: "",
        updated_at: "",
      },
    ],
  },
]

const states: RocketIndividualState[] = [
  { item_id: "item-1", profile_id: "m1", is_checked: true, created_at: "2026-03-20T10:00:00Z", updated_at: "2026-03-20T10:00:00Z" },
]

const teamChecks: RocketTeamCheck[] = []

describe("RocketPresentationDialog", () => {
  it("renders the active slide with large text, category title, and team members grid", () => {
    const onOpenChange = vi.fn()
    render(
      <RocketPresentationDialog
        open={true}
        onOpenChange={onOpenChange}
        categories={categories}
        teamMembers={members}
        states={states}
        teamChecks={teamChecks}
        profileId="m1"
        onToggleIndividual={vi.fn()}
      />,
    )

    // Heading of current slide
    expect(screen.getByRole("heading", { level: 1, name: "První položka prezentace" })).toBeInTheDocument()
    // Category title
    expect(screen.getAllByText("Kategorie 1")[0]).toBeInTheDocument()
    // Counter
    expect(screen.getAllByText("1 / 2").length).toBeGreaterThan(0)

    // Team members grid
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.getByText("Zapojení týmu")).toBeInTheDocument()

    // Status: Alice has completed, Bob has not yet
    expect(screen.getAllByText("Splněno").length).toBeGreaterThan(0)
    expect(screen.getByText("Zatím ne")).toBeInTheDocument()
  })

  it("allows toggling personal completion for the slide item", async () => {
    const user = userEvent.setup()
    const onToggleIndividual = vi.fn().mockResolvedValue(undefined)

    render(
      <RocketPresentationDialog
        open={true}
        onOpenChange={vi.fn()}
        categories={categories}
        teamMembers={members}
        states={states}
        teamChecks={teamChecks}
        profileId="m1"
        onToggleIndividual={onToggleIndividual}
      />,
    )

    // Alice (m1) has checked item-1, so button shows "Máš splněno"
    const toggleButton = screen.getByRole("button", { name: /Máš splněno/i })
    expect(toggleButton).toBeInTheDocument()

    await user.click(toggleButton)
    expect(onToggleIndividual).toHaveBeenCalledWith("item-1", false)
  })

  it("navigates forward and backward with buttons and notifies onActiveItemChange", async () => {
    const user = userEvent.setup()
    const onActiveItemChange = vi.fn()

    render(
      <RocketPresentationDialog
        open={true}
        onOpenChange={vi.fn()}
        categories={categories}
        teamMembers={members}
        states={states}
        teamChecks={teamChecks}
        profileId="m1"
        onActiveItemChange={onActiveItemChange}
        onToggleIndividual={vi.fn()}
      />,
    )

    expect(onActiveItemChange).toHaveBeenCalledWith("item-1")

    // Click next button
    const nextButton = screen.getByRole("button", { name: /Další/i })
    await user.click(nextButton)

    // Now slide 2 is shown
    expect(screen.getByRole("heading", { level: 1, name: "Druhá položka prezentace" })).toBeInTheDocument()
    expect(screen.getAllByText("2 / 2").length).toBeGreaterThan(0)
    expect(onActiveItemChange).toHaveBeenCalledWith("item-2")

    // Previous button should navigate back
    const prevButton = screen.getByRole("button", { name: /Předchozí/i })
    await user.click(prevButton)

    expect(screen.getByRole("heading", { level: 1, name: "První položka prezentace" })).toBeInTheDocument()
    expect(screen.getAllByText("1 / 2").length).toBeGreaterThan(0)
  })

  it("navigates slides with arrow keys", () => {
    const onActiveItemChange = vi.fn()

    render(
      <RocketPresentationDialog
        open={true}
        onOpenChange={vi.fn()}
        categories={categories}
        teamMembers={members}
        states={states}
        teamChecks={teamChecks}
        profileId="m1"
        onActiveItemChange={onActiveItemChange}
        onToggleIndividual={vi.fn()}
      />,
    )

    // Trigger right arrow
    fireEvent.keyDown(window, { key: "ArrowRight" })
    expect(screen.getByRole("heading", { level: 1, name: "Druhá položka prezentace" })).toBeInTheDocument()

    // Trigger left arrow
    fireEvent.keyDown(window, { key: "ArrowLeft" })
    expect(screen.getByRole("heading", { level: 1, name: "První položka prezentace" })).toBeInTheDocument()
  })

  it("notifies with null when dialog closes", () => {
    const onActiveItemChange = vi.fn()
    const onOpenChange = vi.fn()

    const { rerender } = render(
      <RocketPresentationDialog
        open={true}
        onOpenChange={onOpenChange}
        categories={categories}
        teamMembers={members}
        states={states}
        teamChecks={teamChecks}
        profileId="m1"
        onActiveItemChange={onActiveItemChange}
        onToggleIndividual={vi.fn()}
      />,
    )

    rerender(
      <RocketPresentationDialog
        open={false}
        onOpenChange={onOpenChange}
        categories={categories}
        teamMembers={members}
        states={states}
        teamChecks={teamChecks}
        profileId="m1"
        onActiveItemChange={onActiveItemChange}
        onToggleIndividual={vi.fn()}
      />,
    )

    expect(onActiveItemChange).toHaveBeenCalledWith(null)
  })

  it("toggles fullscreen mode", async () => {
    const user = userEvent.setup()

    render(
      <RocketPresentationDialog
        open={true}
        onOpenChange={vi.fn()}
        categories={categories}
        teamMembers={members}
        states={states}
        teamChecks={teamChecks}
        profileId="m1"
        defaultFullscreen={true}
        onToggleIndividual={vi.fn()}
      />,
    )

    const fullscreenButton = screen.getByRole("button", { name: "Ukončit celou obrazovku" })
    await user.click(fullscreenButton)

    expect(screen.getByRole("button", { name: "Režim celé obrazovky" })).toBeInTheDocument()
  })
})
