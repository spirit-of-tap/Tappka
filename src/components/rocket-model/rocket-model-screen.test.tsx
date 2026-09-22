import React from "react"
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import confetti from "canvas-confetti"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { setIndividualCheck, setTeamCheck } from "@/lib/rocket-model/queries"
import {
  ROCKET_INDIVIDUAL_UPDATED_EVENT,
  ROCKET_TEAM_UPDATED_EVENT,
  type RocketCategoryWithItems,
  type RocketIndividualState,
  type RocketTeamBroadcast,
} from "@/lib/rocket-model/types"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"
import { RocketModelScreen } from "./rocket-model-screen"

const broadcastListeners = new Map<string, (msg: { payload: unknown }) => void>()

const mockChannel = {
  state: "joined",
  send: vi.fn().mockResolvedValue("ok"),
  httpSend: vi.fn().mockResolvedValue("ok"),
  on: vi.fn((_type: string, filter: { event: string }, callback: (msg: { payload: unknown }) => void) => {
    broadcastListeners.set(filter.event, callback)
    return mockChannel
  }),
  subscribe: vi.fn((callback?: (status: string) => void) => {
    callback?.("SUBSCRIBED")
    return mockChannel
  }),
}

const mockSupabase = {
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
  realtime: {
    setAuth: vi.fn().mockResolvedValue(undefined),
  },
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}))

vi.mock("@/lib/rocket-model/queries", () => ({
  setIndividualCheck: vi.fn().mockResolvedValue(undefined),
  setTeamCheck: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

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
      return <div style={{ width: 500, height: 500 }}>{content}</div>
    },
  }
})

const ME = "profile-me"
const OTHER = "profile-other"

const members: TeamMemberProfile[] = [
  { id: ME, name: "Já", picture: null, role: "student" },
  { id: OTHER, name: "Kolega", picture: null, role: "student" },
]

function makeCategories(): RocketCategoryWithItems[] {
  return [
    {
      id: "cat-y1",
      code: "Y1",
      title: "Y1 - The process of Individual Learning",
      order_index: 0,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      items: [
        {
          id: "item-1",
          category_id: "cat-y1",
          order_index: 0,
          text_cs: "Každý člen týmu si vede Learning Diary.",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "item-2",
          category_id: "cat-y1",
          order_index: 1,
          text_cs: "Každý člen týmu má svůj Reading Plan.",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    },
  ]
}

function makeState(itemId: string, profileId: string): RocketIndividualState {
  return {
    item_id: itemId,
    profile_id: profileId,
    is_checked: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }
}

describe("RocketModelScreen — automatic team check and confetti", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    broadcastListeners.clear()
  })

  it("automatically checks team box and triggers confetti when checking completes unanimity", async () => {
    const user = userEvent.setup()
    // OTHER has already checked item-1, ME has not checked yet
    render(
      <RocketModelScreen
        initialCategories={makeCategories()}
        teamMembers={members}
        initialStates={[makeState("item-1", OTHER)]}
        initialTeamChecks={[]}
        history={[]}
        profileId={ME}
        teamId="team-1"
      />,
    )

    const checkbox = screen.getByRole("checkbox", {
      name: "Každý člen týmu si vede Learning Diary.",
    })
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)

    // Individual check persisted and broadcast
    expect(setIndividualCheck).toHaveBeenCalledWith(
      expect.anything(),
      { itemId: "item-1", profileId: ME, isChecked: true },
    )
    expect(mockChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "broadcast",
        event: ROCKET_INDIVIDUAL_UPDATED_EVENT,
        payload: { item_id: "item-1", profile_id: ME, is_checked: true },
      }),
    )

    // Team check automatically persisted
    expect(setTeamCheck).toHaveBeenCalledWith(
      expect.anything(),
      { teamId: "team-1", itemId: "item-1", isChecked: true, profileId: ME },
    )

    // Team check broadcast sent
    expect(mockChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "broadcast",
        event: ROCKET_TEAM_UPDATED_EVENT,
        payload: { team_id: "team-1", item_id: "item-1", is_checked: true, checked_by_profile_id: ME },
      }),
    )

    // Confetti triggered
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 60,
        spread: 70,
      }),
    )

    // Toast shown
    expect(toast.success).toHaveBeenCalledWith(
      "Tým dosáhl shody",
      expect.objectContaining({
        description: "Každý člen týmu si vede Learning Diary.",
      }),
    )

    // Switch to team view and verify the team checkbox is checked
    await user.click(screen.getByRole("tab", { name: /Týmový přehled/ }))
    const teamSection = screen.getByRole("tabpanel", { name: /Týmový přehled/ })
    const teamCheck = within(teamSection).getByRole("checkbox", {
      name: /Každý člen týmu si vede Learning Diary\./,
    })
    expect(teamCheck).toBeChecked()
    expect(within(teamSection).getByText("Potvrzeno týmem")).toBeVisible()
  })

  it("does not auto-check or fire confetti when checking does not achieve unanimity", async () => {
    const user = userEvent.setup()
    // Neither ME nor OTHER has checked item-2 yet
    render(
      <RocketModelScreen
        initialCategories={makeCategories()}
        teamMembers={members}
        initialStates={[]}
        initialTeamChecks={[]}
        history={[]}
        profileId={ME}
        teamId="team-1"
      />,
    )

    const checkbox = screen.getByRole("checkbox", {
      name: "Každý člen týmu má svůj Reading Plan.",
    })
    await user.click(checkbox)

    expect(setIndividualCheck).toHaveBeenCalledWith(
      expect.anything(),
      { itemId: "item-2", profileId: ME, isChecked: true },
    )
    // Only 1 of 2 members checked: no team check or confetti
    expect(setTeamCheck).not.toHaveBeenCalled()
    expect(confetti).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("does not auto-check or fire confetti when an item is unchecked", async () => {
    const user = userEvent.setup()
    render(
      <RocketModelScreen
        initialCategories={makeCategories()}
        teamMembers={members}
        initialStates={[makeState("item-1", ME), makeState("item-1", OTHER)]}
        initialTeamChecks={[]}
        history={[]}
        profileId={ME}
        teamId="team-1"
      />,
    )

    const checkbox = screen.getByRole("checkbox", {
      name: "Každý člen týmu si vede Learning Diary.",
    })
    expect(checkbox).toBeChecked()

    await user.click(checkbox)

    expect(setIndividualCheck).toHaveBeenCalledWith(
      expect.anything(),
      { itemId: "item-1", profileId: ME, isChecked: false },
    )
    expect(setTeamCheck).not.toHaveBeenCalled()
    expect(confetti).not.toHaveBeenCalled()
  })

  it("triggers confetti and updates team state when receiving ROCKET_TEAM_UPDATED_EVENT from teammate", async () => {
    render(
      <RocketModelScreen
        initialCategories={makeCategories()}
        teamMembers={members}
        initialStates={[makeState("item-1", ME)]}
        initialTeamChecks={[]}
        history={[]}
        profileId={ME}
        teamId="team-1"
      />,
    )

    // Simulate incoming team broadcast from OTHER
    const onTeamUpdate = broadcastListeners.get(ROCKET_TEAM_UPDATED_EVENT)
    expect(onTeamUpdate).toBeDefined()

    act(() => {
      onTeamUpdate!({
        payload: {
          team_id: "team-1",
          item_id: "item-1",
          is_checked: true,
          checked_by_profile_id: OTHER,
        } satisfies RocketTeamBroadcast,
      })
    })

    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 60,
        spread: 70,
      }),
    )
    expect(toast.success).toHaveBeenCalledWith(
      "Tým dosáhl shody",
      expect.objectContaining({
        description: "Každý člen týmu si vede Learning Diary.",
      }),
    )
  })

  it("does not trigger confetti when receiving ROCKET_TEAM_UPDATED_EVENT for uncheck", async () => {
    render(
      <RocketModelScreen
        initialCategories={makeCategories()}
        teamMembers={members}
        initialStates={[makeState("item-1", ME)]}
        initialTeamChecks={[]}
        history={[]}
        profileId={ME}
        teamId="team-1"
      />,
    )

    const onTeamUpdate = broadcastListeners.get(ROCKET_TEAM_UPDATED_EVENT)
    act(() => {
      onTeamUpdate!({
        payload: {
          team_id: "team-1",
          item_id: "item-1",
          is_checked: false,
          checked_by_profile_id: OTHER,
        } satisfies RocketTeamBroadcast,
      })
    })

    expect(confetti).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("automatically checks team box immediately for single-member team", async () => {
    const user = userEvent.setup()
    const soloMember: TeamMemberProfile[] = [
      { id: ME, name: "Já", picture: null, role: "student" },
    ]

    render(
      <RocketModelScreen
        initialCategories={makeCategories()}
        teamMembers={soloMember}
        initialStates={[]}
        initialTeamChecks={[]}
        history={[]}
        profileId={ME}
        teamId="team-solo"
      />,
    )

    const checkbox = screen.getByRole("checkbox", {
      name: "Každý člen týmu si vede Learning Diary.",
    })
    await user.click(checkbox)

    expect(setTeamCheck).toHaveBeenCalledWith(
      expect.anything(),
      { teamId: "team-solo", itemId: "item-1", isChecked: true, profileId: ME },
    )
    expect(confetti).toHaveBeenCalled()
  })

  it("does not re-trigger confetti or toast on receiving own ROCKET_TEAM_UPDATED_EVENT", async () => {
    render(
      <RocketModelScreen
        initialCategories={makeCategories()}
        teamMembers={members}
        initialStates={[makeState("item-1", ME)]}
        initialTeamChecks={[]}
        history={[]}
        profileId={ME}
        teamId="team-1"
      />,
    )

    const onTeamUpdate = broadcastListeners.get(ROCKET_TEAM_UPDATED_EVENT)
    act(() => {
      onTeamUpdate!({
        payload: {
          team_id: "team-1",
          item_id: "item-1",
          is_checked: true,
          checked_by_profile_id: ME,
        } satisfies RocketTeamBroadcast,
      })
    })

    expect(confetti).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("reverts state and displays error toast if setTeamCheck fails during auto-confirm", async () => {
    const user = userEvent.setup()
    vi.mocked(setTeamCheck).mockRejectedValueOnce(new Error("DB error"))

    render(
      <RocketModelScreen
        initialCategories={makeCategories()}
        teamMembers={members}
        initialStates={[makeState("item-1", OTHER)]}
        initialTeamChecks={[]}
        history={[]}
        profileId={ME}
        teamId="team-1"
      />,
    )

    const checkbox = screen.getByRole("checkbox", {
      name: "Každý člen týmu si vede Learning Diary.",
    })
    await user.click(checkbox)

    expect(toast.error).toHaveBeenCalledWith("Nepodařilo se uložit týmové hodnocení")

    // Switch to team view and verify team check was reverted
    await user.click(screen.getByRole("tab", { name: /Týmový přehled/ }))
    const teamSection = screen.getByRole("tabpanel", { name: /Týmový přehled/ })
    const teamCheck = within(teamSection).getByRole("checkbox", {
      name: /Každý člen týmu si vede Learning Diary\./,
    })
    expect(teamCheck).not.toBeChecked()
  })
})

