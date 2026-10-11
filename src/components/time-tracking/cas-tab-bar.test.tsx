import { describe, expect, it } from "vitest"

import { casTabHref, getActiveCasTabUrl } from "./cas-tab-bar"

describe("getActiveCasTabUrl", () => {
  it.each([
    ["/cas", "/cas"],
    ["/cas/tym", "/cas/tym"],
    ["/cas/reporting", "/cas/reporting"],
    ["/cas/kalendar", "/cas/kalendar"],
    ["/cas/neco", "/cas"],
    ["/cteni", undefined],
  ])("%s → %s", (pathname, expected) => {
    expect(getActiveCasTabUrl(pathname)).toBe(expected)
  })
})

describe("casTabHref", () => {
  const params = new URLSearchParams("from=2026-10-01&to=2026-10-31&team=t1&tag=x")

  it("keeps the period and a coach's team on the team tabs", () => {
    expect(casTabHref("/cas/reporting", params)).toBe("/cas/reporting?from=2026-10-01&to=2026-10-31&team=t1")
  })

  it("keeps only the period on the personal tabs", () => {
    expect(casTabHref("/cas", params)).toBe("/cas?from=2026-10-01&to=2026-10-31")
    expect(casTabHref("/cas/kalendar", params)).toBe("/cas/kalendar?from=2026-10-01&to=2026-10-31")
  })
})
