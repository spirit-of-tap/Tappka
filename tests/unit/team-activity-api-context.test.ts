import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentUserProfile: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }))
vi.mock("@/lib/auth-helpers", () => ({
  getCurrentUserProfile: mocks.getCurrentUserProfile,
}))

import {
  isApiFailure,
  requireTeamActivityApiContext,
} from "@/app/api/tymovy-denik/activities/_shared"

const USER = { id: "user-1" }
const CLIENT = { auth: { getUser: mocks.getUser } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockResolvedValue(CLIENT)
})

describe("requireTeamActivityApiContext", () => {
  it("rejects requests without an authenticated user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })

    const result = await requireTeamActivityApiContext()

    expect(isApiFailure(result)).toBe(true)
    if (isApiFailure(result)) expect(result.response.status).toBe(401)
    expect(mocks.getCurrentUserProfile).not.toHaveBeenCalled()
  })

  it("rejects profiles without both beta access and a team", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } })
    mocks.getCurrentUserProfile.mockResolvedValue({
      id: "profile-1",
      team_id: "team-1",
      beta_access_granted_at: null,
    })

    const result = await requireTeamActivityApiContext()

    expect(isApiFailure(result)).toBe(true)
    if (isApiFailure(result)) expect(result.response.status).toBe(403)
  })

  it("derives team and actor identity from the authenticated profile", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } })
    mocks.getCurrentUserProfile.mockResolvedValue({
      id: "profile-1",
      team_id: "team-1",
      role: "student",
      beta_access_granted_at: "2026-08-22T12:00:00Z",
      beta_cohort: "B",
    })

    const result = await requireTeamActivityApiContext()

    expect(isApiFailure(result)).toBe(false)
    if (!isApiFailure(result)) {
      expect(result).toEqual({
        profileId: "profile-1",
        teamId: "team-1",
        supabase: CLIENT,
      })
    }
    expect(mocks.getCurrentUserProfile).toHaveBeenCalledWith(CLIENT, { user: USER })
  })
})
