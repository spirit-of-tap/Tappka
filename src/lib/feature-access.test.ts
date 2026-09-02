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
  it("A gets reading only", () => {
    expect(canAccessFeature(a, "reading")).toBe(true)
    expect(canAccessFeature(a, "customerMeetings")).toBe(false)
    expect(canAccessFeature(a, "birthGiving")).toBe(false)
  })
  it("B gets all beta features", () => {
    for (const f of Object.keys(BETA_FEATURES) as (keyof typeof BETA_FEATURES)[]) {
      expect(canAccessFeature(b, f)).toBe(true)
    }
  })
  it("admin bypasses regardless of beta status", () => {
    for (const f of Object.keys(BETA_FEATURES) as (keyof typeof BETA_FEATURES)[]) {
      expect(canAccessFeature(adminNoBeta, f)).toBe(true)
    }
  })
})
