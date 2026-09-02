import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useUnsavedChangesGuard } from "@/lib/essays/use-unsaved-changes-guard"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}))

beforeEach(() => {
  push.mockReset()
})

function clickAnchor(href: string, opts: Partial<MouseEventInit> = {}) {
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.textContent = "link"
  document.body.appendChild(anchor)
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...opts })
  act(() => {
    anchor.dispatchEvent(event)
  })
  document.body.removeChild(anchor)
  return event
}

describe("useUnsavedChangesGuard", () => {
  it("lets an internal link navigate immediately when nothing is blocking", () => {
    renderHook(() => useUnsavedChangesGuard(false))

    const event = clickAnchor("/cteni/prehled")

    expect(event.defaultPrevented).toBe(false)
  })

  it("intercepts an internal link click while blocking, and opens the confirm dialog", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true))

    const event = clickAnchor("/cteni/prehled")

    expect(event.defaultPrevented).toBe(true)
    expect(result.current.isDialogOpen).toBe(true)
  })

  it("navigates to the intercepted link once the user confirms", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true))

    clickAnchor("/cteni/prehled")
    act(() => result.current.confirmLeave())

    expect(push).toHaveBeenCalledWith("/cteni/prehled")
    expect(result.current.isDialogOpen).toBe(false)
  })

  it("stays on the page and does not navigate when the user cancels", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true))

    clickAnchor("/cteni/prehled")
    act(() => result.current.cancelLeave())

    expect(push).not.toHaveBeenCalled()
    expect(result.current.isDialogOpen).toBe(false)
  })

  it("blocks beforeunload while blocking", () => {
    renderHook(() => useUnsavedChangesGuard(true))

    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it("runs a programmatic navigation immediately when nothing is blocking", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(false))
    const action = vi.fn()

    act(() => result.current.requestNavigation(action))

    expect(action).toHaveBeenCalledTimes(1)
    expect(result.current.isDialogOpen).toBe(false)
  })

  it("defers a programmatic navigation until confirmed when blocking", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true))
    const action = vi.fn()

    act(() => result.current.requestNavigation(action))
    expect(action).not.toHaveBeenCalled()
    expect(result.current.isDialogOpen).toBe(true)

    act(() => result.current.confirmLeave())
    expect(action).toHaveBeenCalledTimes(1)
  })
})
