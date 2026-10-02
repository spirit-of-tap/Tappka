import { describe, expect, it } from "vitest"

import { chunk } from "./queries"

describe("chunk", () => {
  it("splits items into chunks of at most the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it("returns no chunks for an empty list", () => {
    expect(chunk([], 100)).toEqual([])
  })

  it("keeps a list at the exact size in one chunk", () => {
    expect(chunk([1, 2, 3], 3)).toEqual([[1, 2, 3]])
  })
})
