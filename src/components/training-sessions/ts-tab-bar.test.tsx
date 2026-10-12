import { describe, expect, it } from "vitest"

import { getActiveTsTabUrl } from "./ts-tab-bar"

describe("getActiveTsTabUrl", () => {
  it("maps routes to tabs", () => {
    expect(getActiveTsTabUrl("/ts/prehled")).toBe("/ts/prehled")
    expect(getActiveTsTabUrl("/ts/nova")).toBe("/ts/prehled")
    expect(getActiveTsTabUrl("/ts/objevovat")).toBe("/ts/objevovat")
    expect(getActiveTsTabUrl("/ts/3f0c2b1e-0000-4000-8000-000000000000")).toBe("/ts/objevovat")
  })
})
