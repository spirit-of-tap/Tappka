"use client"

import * as React from "react"

/** Ignore sub-pixel / toolbar jitter — only a real keyboard counts. */
const MIN_KEYBOARD_INSET_PX = 1

export interface ViewportMetrics {
  innerHeight: number
  visualHeight: number
  visualOffsetTop: number
}

export interface KeyboardInset {
  /** Distance from the layout-viewport bottom to the visible-area bottom. */
  bottom: number
  /** Height of the visible area (above the on-screen keyboard). */
  visibleHeight: number
}

/**
 * How far a `position: fixed; bottom: 0` element must be lifted so it sits on
 * top of the on-screen keyboard. iOS Safari both shrinks the visual viewport
 * AND pans it (`offsetTop`), so the offset must subtract both — ignoring
 * `offsetTop` (as vaul's `repositionInputs` does) double-shifts the drawer
 * off the top of the screen.
 */
export function getKeyboardInset({
  innerHeight,
  visualHeight,
  visualOffsetTop,
}: ViewportMetrics): KeyboardInset | null {
  const bottom = innerHeight - visualHeight - visualOffsetTop
  if (bottom < MIN_KEYBOARD_INSET_PX) return null
  return { bottom, visibleHeight: visualHeight }
}

/**
 * Tracks the on-screen keyboard via `window.visualViewport`. Returns `null`
 * while no keyboard is shown (or when the API is unavailable).
 */
export function useKeyboardInset(enabled = true): KeyboardInset | null {
  const [inset, setInset] = React.useState<KeyboardInset | null>(null)

  React.useEffect(() => {
    const viewport = window.visualViewport
    if (!enabled || !viewport) return

    const update = () => {
      const next = getKeyboardInset({
        innerHeight: window.innerHeight,
        visualHeight: viewport.height,
        visualOffsetTop: viewport.offsetTop,
      })
      setInset((prev) =>
        prev?.bottom === next?.bottom &&
        prev?.visibleHeight === next?.visibleHeight
          ? prev
          : next
      )
    }

    update()
    viewport.addEventListener("resize", update)
    viewport.addEventListener("scroll", update)
    return () => {
      viewport.removeEventListener("resize", update)
      viewport.removeEventListener("scroll", update)
      setInset(null)
    }
  }, [enabled])

  return inset
}
