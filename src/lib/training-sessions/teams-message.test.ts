import { describe, expect, it } from "vitest"

import { buildTeamsMessage } from "./teams-message"

const BASE = {
  topic: "AI v projektech",
  // 9 Nov 2026 is a Monday; 06:35Z = 7:35 in Prague (CET).
  startsAt: "2026-11-09T06:35:00Z",
  endsAt: "2026-11-09T08:35:00Z",
  sessionUrl: "https://tappka.cz/ts/abc",
}

describe("buildTeamsMessage", () => {
  it("announces the preparation with topic, time, link and facilitators", () => {
    expect(buildTeamsMessage({ ...BASE, facilitatorNames: ["Jana Nováková", "Petr Svoboda"] })).toBe(
      [
        "Ahoj,",
        "",
        "příprava na TS „AI v projektech“ (pondělí 9. listopadu, 7:35–9:35) je připravená v Tappce:",
        "https://tappka.cz/ts/abc",
        "",
        "Mějte se fajn",
        "Jana Nováková, Petr Svoboda",
      ].join("\n"),
    )
  })

  it("omits the signature line when no facilitator has a name", () => {
    expect(buildTeamsMessage({ ...BASE, facilitatorNames: [] }).endsWith("Mějte se fajn")).toBe(true)
  })
})
