import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useEssaySave } from "@/lib/essays/use-essay-save"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useEssaySave", () => {
  it("does not call save() until markDirty() has been called", async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useEssaySave({ save, enabled: true }))

    await act(async () => {
      await result.current.save()
    })

    expect(save).not.toHaveBeenCalled()
  })

  it("saves after markDirty(), clears dirty, and reports the saved status", async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useEssaySave({ save, enabled: true }))

    act(() => result.current.markDirty())
    expect(result.current.isDirty).toBe(true)

    await act(async () => {
      await result.current.save()
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(result.current.isDirty).toBe(false)
    expect(result.current.status).toBe("saved")
    expect(result.current.lastSavedAt).not.toBeNull()
  })

  it("does not persist while disabled, even after markDirty()", async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useEssaySave({ save, enabled: false }))

    act(() => result.current.markDirty())
    await act(async () => {
      await result.current.save()
    })

    expect(save).not.toHaveBeenCalled()
  })

  it("sets an error status and keeps the change dirty so the next save() retries it", async () => {
    const save = vi.fn().mockRejectedValue(new Error("network down"))
    const { result } = renderHook(() => useEssaySave({ save, enabled: true }))

    act(() => result.current.markDirty())
    await act(async () => {
      await result.current.save()
    })

    expect(result.current.status).toBe("error")
    expect(result.current.isDirty).toBe(true)

    save.mockResolvedValue(undefined)
    await act(async () => {
      await result.current.save()
    })

    expect(result.current.status).toBe("saved")
    expect(result.current.isDirty).toBe(false)
  })

  it("ignores a second save() call while one is already in flight", async () => {
    let resolveSave: () => void = () => {}
    const save = vi.fn(() => new Promise<void>((resolve) => {
      resolveSave = resolve
    }))
    const { result } = renderHook(() => useEssaySave({ save, enabled: true }))

    act(() => result.current.markDirty())
    let firstSave: Promise<void> = Promise.resolve()
    act(() => {
      firstSave = result.current.save()
    })
    act(() => {
      void result.current.save()
    })

    expect(save).toHaveBeenCalledTimes(1)

    resolveSave()
    await act(async () => {
      await firstSave
    })
  })

  it("blocks beforeunload while there are unsaved changes", () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useEssaySave({ save, enabled: true }))

    act(() => result.current.markDirty())

    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it("does not block beforeunload once there is nothing unsaved", () => {
    const save = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useEssaySave({ save, enabled: true }))

    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it("triggers save() on Cmd/Ctrl+S", async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useEssaySave({ save, enabled: true }))

    act(() => result.current.markDirty())

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(save).toHaveBeenCalledTimes(1)
  })
})
