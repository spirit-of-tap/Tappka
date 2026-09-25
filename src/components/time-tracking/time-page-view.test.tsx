import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { TimeEntryWithTag, TimeTag } from "@/lib/time-tracking/types"
import { getWeekRange } from "@/lib/time-tracking/week"

import { TimePageView } from "./time-page-view"

const replace = vi.fn()
let searchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace, push: vi.fn() }),
  usePathname: () => "/cas",
  useSearchParams: () => searchParams,
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

// Friday 2026-09-25 14:00 Prague; week Mon 21. 9. – Sun 27. 9.
const NOW = new Date("2026-09-25T12:00:00Z")
const WEEK = getWeekRange(NOW)
const PROFILE_ID = "p1"

const TAGS: TimeTag[] = [
  { id: "t-book", name: "Kniha", profile_id: PROFILE_ID, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" } as TimeTag,
]

let seq = 0
function makeEntry(overrides: Partial<TimeEntryWithTag>): TimeEntryWithTag {
  seq += 1
  return {
    id: `e${seq}`,
    profile_id: PROFILE_ID,
    created_by_profile_id: PROFILE_ID,
    updated_by_profile_id: PROFILE_ID,
    attendance_id: null,
    direction: "training",
    source: "manual",
    title: null,
    tag_id: null,
    tag: null,
    started_at: "2026-09-22T08:00:00Z",
    ended_at: "2026-09-22T09:00:00Z",
    duration_ms: 3_600_000,
    created_at: "2026-09-22T09:00:00Z",
    updated_at: "2026-09-22T09:00:00Z",
    ...overrides,
  }
}

const MONDAY_TRAINING = makeEntry({
  title: "Training Session",
  direction: "training",
  source: "attendance",
  started_at: "2026-09-21T07:00:00Z",
  ended_at: "2026-09-21T11:00:00Z",
  duration_ms: 4 * 3_600_000,
})
const WEDNESDAY_READING = makeEntry({
  title: "Lean Startup",
  direction: "reading",
  tag_id: "t-book",
  tag: { id: "t-book", name: "Kniha" },
  started_at: "2026-09-23T16:00:00Z",
  ended_at: "2026-09-23T17:30:00Z",
  duration_ms: 90 * 60_000,
})
const WEDNESDAY_PRACTISE = makeEntry({
  title: "Stánek",
  direction: "practise",
  started_at: "2026-09-23T08:00:00Z",
  ended_at: "2026-09-23T10:00:00Z",
  duration_ms: 2 * 3_600_000,
})
const RUNNING = makeEntry({
  title: "Běžící práce",
  direction: "practise",
  source: "timer",
  started_at: "2026-09-25T11:30:00Z",
  ended_at: null,
  duration_ms: null,
})

function renderView(entries: TimeEntryWithTag[]) {
  return render(<TimePageView entries={entries} tags={TAGS} week={WEEK} now={NOW} profileId={PROFILE_ID} />)
}

describe("TimePageView", () => {
  beforeEach(() => {
    replace.mockReset()
    searchParams = new URLSearchParams()
  })

  it("shows the empty state", () => {
    renderView([])

    expect(screen.getByText("Zatím žádný záznam. Spusť časomíru nebo zapiš čas ručně.")).toBeInTheDocument()
    expect(screen.getByText("0 záznamů")).toBeInTheDocument()
  })

  it("groups entries by day, newest day first, with the running timer pinned on top", () => {
    renderView([RUNNING, WEDNESDAY_READING, WEDNESDAY_PRACTISE, MONDAY_TRAINING])

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)
    expect(headings).toEqual(["středa 23. 9.", "pondělí 21. 9."])

    const labels = screen
      .getAllByText(/Běžící práce|Lean Startup|Stánek|Training Session/)
      .map((element) => element.textContent)
    expect(labels).toEqual(["Běžící práce", "Lean Startup", "Stánek", "Training Session"])

    // Running for 30 min at NOW.
    expect(screen.getByText("00:30:00")).toBeInTheDocument()
    expect(screen.getByText("z docházky")).toBeInTheDocument()
    expect(screen.getByText("4 záznamy")).toBeInTheDocument()
  })

  it("sums the week per direction including the running timer", () => {
    renderView([RUNNING, WEDNESDAY_READING, WEDNESDAY_PRACTISE, MONDAY_TRAINING])

    expect(screen.getByTestId("direction-total-training")).toHaveTextContent("4")
    expect(screen.getByTestId("direction-total-reading")).toHaveTextContent("1,5")
    expect(screen.getByTestId("direction-total-practise")).toHaveTextContent("2,5")
  })

  it("filters by direction and tag from the URL", () => {
    searchParams = new URLSearchParams("direction=reading&tag=t-book")
    renderView([WEDNESDAY_READING, WEDNESDAY_PRACTISE, MONDAY_TRAINING])

    expect(screen.getByText("Lean Startup")).toBeInTheDocument()
    expect(screen.queryByText("Stánek")).not.toBeInTheDocument()
    expect(screen.queryByText("Training Session")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reading" })).toHaveAttribute("aria-pressed", "true")
  })

  it("shows a reset when nothing matches the filter", async () => {
    searchParams = new URLSearchParams("w=2026-09-21&direction=reading")
    const user = userEvent.setup()
    renderView([MONDAY_TRAINING])

    expect(screen.getByText("Nic neodpovídá filtru")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Zrušit filtry" }))
    expect(replace).toHaveBeenCalledWith("/cas?w=2026-09-21", { scroll: false })
  })

  it("toggles a direction chip in the URL and keeps the week param", async () => {
    searchParams = new URLSearchParams("w=2026-09-21")
    const user = userEvent.setup()
    renderView([MONDAY_TRAINING])

    const filters = screen.getByRole("group", { name: "Filtry" })
    await user.click(within(filters).getByRole("button", { name: "Practise" }))

    expect(replace).toHaveBeenCalledWith("/cas?w=2026-09-21&direction=practise", { scroll: false })
  })
})
