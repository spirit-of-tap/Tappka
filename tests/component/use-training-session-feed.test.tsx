import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useTrainingSessionFeed } from "@/lib/training-sessions/use-training-session-feed"

type SubscribeCallback = (status: string, err?: unknown) => void

const mocks = vi.hoisted(() => ({
  subscribeCallbacks: [] as SubscribeCallback[],
  subscribedEvents: [] as string[],
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channel = {
      on: (_type: string, filter: { event: string }) => {
        mocks.subscribedEvents.push(filter.event)
        return channel
      },
      subscribe: (callback: SubscribeCallback) => {
        mocks.subscribeCallbacks.push(callback)
        return channel
      },
    }
    return {
      channel: () => channel,
      realtime: { setAuth: () => Promise.resolve() },
      removeChannel: () => Promise.resolve("ok"),
    }
  },
}))

async function renderFeed(onEvent: () => void) {
  renderHook(() => useTrainingSessionFeed(onEvent))
  await waitFor(() => expect(mocks.subscribeCallbacks).toHaveLength(1))
  return mocks.subscribeCallbacks[0]
}

afterEach(() => {
  mocks.subscribeCallbacks.length = 0
  mocks.subscribedEvents.length = 0
  vi.restoreAllMocks()
})

describe("useTrainingSessionFeed", () => {
  it("subscribes to every training session broadcast event", async () => {
    await renderFeed(vi.fn())
    expect(mocks.subscribedEvents).toEqual(["guest_joined", "guest_left", "session_updated"])
  })

  it("does not refresh on the initial subscribe", async () => {
    const onEvent = vi.fn()
    const subscribe = await renderFeed(onEvent)
    act(() => subscribe("SUBSCRIBED"))
    expect(onEvent).not.toHaveBeenCalled()
  })

  it("refreshes once when the channel reconnects after a transport error", async () => {
    const onEvent = vi.fn()
    const subscribe = await renderFeed(onEvent)
    act(() => subscribe("SUBSCRIBED"))
    act(() => subscribe("CHANNEL_ERROR", undefined))
    act(() => subscribe("SUBSCRIBED"))
    expect(onEvent).toHaveBeenCalledTimes(1)
  })

  it("reports repeated transport drops once, as a warning", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const subscribe = await renderFeed(vi.fn())

    act(() => {
      subscribe("SUBSCRIBED")
      subscribe("CHANNEL_ERROR", undefined)
      subscribe("CHANNEL_ERROR", undefined)
      subscribe("TIMED_OUT", undefined)
    })

    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it("keeps logging channel-level errors that carry a reason", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const subscribe = await renderFeed(vi.fn())

    act(() => subscribe("CHANNEL_ERROR", new Error("Unauthorized")))

    expect(errorSpy).toHaveBeenCalledWith("Training session feed error:", new Error("Unauthorized"))
  })
})
