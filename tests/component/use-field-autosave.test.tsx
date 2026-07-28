import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useFieldAutosave } from "@/lib/tymova-reflexe/use-field-autosave"

type Field = "what_went_well" | "responsible_person"

interface Row {
  id: string
  updated_at: string
  what_went_well: string | null
  responsible_person: string | null
}

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "row-1",
    updated_at: "2026-01-01T00:00:00Z",
    what_went_well: null,
    responsible_person: null,
    ...overrides,
  }
}

const FIELDS: Field[] = ["what_went_well", "responsible_person"]

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useFieldAutosave", () => {
  it("debounces saves and only sends the fields that were touched", async () => {
    const save = vi.fn(async (payload: Partial<Record<Field, string | null>>, current: Row) => ({
      ...current,
      ...payload,
      updated_at: "2026-01-01T00:00:05Z",
    }))

    const { result } = renderHook(() =>
      useFieldAutosave<Row, Field>({ initial: makeRow(), fields: FIELDS, save }),
    )

    act(() => result.current.setField("what_went_well", "Skvělý sprint"))
    expect(save).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0]).toEqual({ what_went_well: "Skvělý sprint" })
    expect(result.current.dirtyFields.size).toBe(0)
  })

  it("does not let an incoming broadcast overwrite a field the user is still editing", async () => {
    const save = vi.fn()
    const { result } = renderHook(() =>
      useFieldAutosave<Row, Field>({ initial: makeRow(), fields: FIELDS, save }),
    )

    act(() => result.current.setField("what_went_well", "still typing"))

    act(() => {
      result.current.applyIncoming(
        makeRow({ responsible_person: "Karel", updated_at: "2026-01-01T00:00:01Z" }),
      )
    })

    expect(result.current.data.what_went_well).toBe("still typing")
    expect(result.current.data.responsible_person).toBe("Karel")
  })

  it("reports a conflict when the incoming update touched a field the user is mid-edit on", async () => {
    const onConflict = vi.fn()
    const save = vi.fn()
    const { result } = renderHook(() =>
      useFieldAutosave<Row, Field>({ initial: makeRow(), fields: FIELDS, save, onConflict }),
    )

    act(() => result.current.setField("what_went_well", "my edit"))
    act(() => {
      result.current.applyIncoming(
        makeRow({ what_went_well: "someone else's edit", updated_at: "2026-01-01T00:00:01Z" }),
      )
    })

    expect(result.current.data.what_went_well).toBe("my edit")
    expect(onConflict).toHaveBeenCalledWith(["what_went_well"])
  })
})
