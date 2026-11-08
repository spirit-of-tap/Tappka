import { describe, expect, it } from "vitest"

import { canEditPreparation } from "./permissions"

describe("canEditPreparation", () => {
  it("lets the session's facilitators edit", () => {
    expect(canEditPreparation({ profileId: "p1", role: "student" }, ["p1", "p2"])).toBe(true)
  })

  it("keeps other people out, coaches included", () => {
    expect(canEditPreparation({ profileId: "p3", role: "student" }, ["p1"])).toBe(false)
    expect(canEditPreparation({ profileId: "p3", role: "coach" }, ["p1"])).toBe(false)
  })

  it("lets admins edit any session's preparation", () => {
    expect(canEditPreparation({ profileId: "p9", role: "admin" }, [])).toBe(true)
  })
})
