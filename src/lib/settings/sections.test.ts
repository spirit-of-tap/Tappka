import { describe, expect, it } from "vitest"

import { SETTINGS_ROUTES, activeSettingsSection, visibleSettingsSections } from "./sections"

const student = { role: "student", beta_access_granted_at: "2026-09-01T00:00:00Z", beta_cohort: "A" as const, teamId: "t1" }
const noBeta = { role: "student", beta_access_granted_at: null, beta_cohort: "A" as const, teamId: null }
const coach = { role: "coach", beta_access_granted_at: null, beta_cohort: "A" as const }

describe("visibleSettingsSections", () => {
  it("shows notifications and Čas tags to a student with Čas access, but not rooms", () => {
    expect(visibleSettingsSections(student).map((s) => s.id)).toEqual(["notifikace", "cas", "ts"])
  })

  it("follows Čas feature access (released, so also without beta)", () => {
    expect(visibleSettingsSections(noBeta).map((s) => s.id)).toEqual(["notifikace", "cas"])
  })

  it("shows rooms to coaches and admins", () => {
    expect(visibleSettingsSections(coach).map((s) => s.id)).toContain("mistnosti")
    expect(visibleSettingsSections({ ...coach, role: "admin" }).map((s) => s.id)).toContain("mistnosti")
  })
})

describe("team calendar section", () => {
  it("needs a team, unless coach or admin", () => {
    expect(visibleSettingsSections(noBeta).map((s) => s.id)).not.toContain("ts")
    expect(visibleSettingsSections(coach).map((s) => s.id)).toContain("ts")
  })
})

describe("activeSettingsSection", () => {
  it("matches a section and its subpaths, and nothing on the hub itself", () => {
    expect(activeSettingsSection(SETTINGS_ROUTES.mistnosti)).toBe("mistnosti")
    expect(activeSettingsSection(`${SETTINGS_ROUTES.cas}/x`)).toBe("cas")
    expect(activeSettingsSection(SETTINGS_ROUTES.root)).toBeNull()
  })
})
