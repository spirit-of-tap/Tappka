import { describe, expect, it } from "vitest"

import { getKeyboardInset } from "./use-keyboard-inset"

describe("getKeyboardInset", () => {
  it("returns null when no keyboard is shown", () => {
    expect(
      getKeyboardInset({ innerHeight: 800, visualHeight: 800, visualOffsetTop: 0 })
    ).toBeNull()
  })

  it("lifts by the keyboard height when the viewport is not panned", () => {
    expect(
      getKeyboardInset({ innerHeight: 800, visualHeight: 500, visualOffsetTop: 0 })
    ).toEqual({ bottom: 300, visibleHeight: 500 })
  })

  it("subtracts iOS viewport panning so the drawer is not double-shifted", () => {
    expect(
      getKeyboardInset({ innerHeight: 800, visualHeight: 500, visualOffsetTop: 120 })
    ).toEqual({ bottom: 180, visibleHeight: 500 })
  })

  it("returns null when the viewport is fully panned onto the keyboard area", () => {
    expect(
      getKeyboardInset({ innerHeight: 800, visualHeight: 500, visualOffsetTop: 300 })
    ).toBeNull()
  })
})
