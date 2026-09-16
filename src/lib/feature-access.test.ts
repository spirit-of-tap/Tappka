import { describe, it, expect } from "vitest"
import { canAccessFeature, BETA_FEATURES } from "./feature-access"

const nonBeta = { role: "student", beta_access_granted_at: null, beta_cohort: "A" as const }
const a = { role: "student", beta_access_granted_at: "2026-01-01T00:00:00Z", beta_cohort: "A" as const }
const b = { role: "student", beta_access_granted_at: "2026-01-01T00:00:00Z", beta_cohort: "B" as const }
const adminNoBeta = { role: "admin", beta_access_granted_at: null, beta_cohort: "A" as const }

describe("canAccessFeature", () => {
  it("denies all beta features without enrollment", () => {
    for (const f of Object.keys(BETA_FEATURES) as (keyof typeof BETA_FEATURES)[]) {
      expect(canAccessFeature(nonBeta, f)).toBe(false)
    }
  })
  it("A gets no beta features (only cohort B is gated in)", () => {
    expect(canAccessFeature(a, "customerMeetings")).toBe(false)
    expect(canAccessFeature(a, "birthGiving")).toBe(false)
  })
  it("B gets all beta features except team-gated rocketModel", () => {
    for (const f of Object.keys(BETA_FEATURES) as (keyof typeof BETA_FEATURES)[]) {
      if (f === "rocketModel") continue
      expect(canAccessFeature(b, f)).toBe(true)
    }
  })
  it("admin bypasses regardless of beta status", () => {
    for (const f of Object.keys(BETA_FEATURES) as (keyof typeof BETA_FEATURES)[]) {
      expect(canAccessFeature(adminNoBeta, f)).toBe(true)
    }
  })
  it("rocketModel is denied for cohort B outside team Tuuli", () => {
    expect(canAccessFeature(b, "rocketModel")).toBe(false)
  })
  it("rocketModel is allowed for team Tuuli with beta enrollment (any cohort)", () => {
    const tuuliB = { ...b, teamName: "Tuuli" }
    const tuuliA = { ...a, teamName: "Tuuli" }
    expect(canAccessFeature(tuuliB, "rocketModel")).toBe(true)
    expect(canAccessFeature(tuuliA, "rocketModel")).toBe(true)
  })
  it("rocketModel is denied for team Tuuli without beta enrollment", () => {
    expect(canAccessFeature({ ...nonBeta, teamName: "Tuuli" }, "rocketModel")).toBe(false)
  })
  it("rocketModel is denied for other teams even with beta enrollment", () => {
    expect(canAccessFeature({ ...b, teamName: "Viento" }, "rocketModel")).toBe(false)
  })
  it("rocketModel is allowed for admin without a team", () => {
    expect(canAccessFeature(adminNoBeta, "rocketModel")).toBe(true)
  })
})
