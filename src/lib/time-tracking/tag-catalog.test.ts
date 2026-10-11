import { describe, expect, it } from "vitest"

import {
  findTeamTagByName,
  hasTeamTags,
  isTagRequired,
  listNewTeamTags,
  normalizeTagName,
  pickerTags,
} from "./tag-catalog"
import type { TimeDirection, TimeTag } from "./types"

const ME = "p-me"
const OTHER = "p-other"

function tag(
  id: string,
  direction: TimeDirection,
  overrides: Partial<TimeTag> = {},
): TimeTag {
  const system = direction === "training" || direction === "reading"
  return {
    id,
    name: id,
    direction,
    team_id: system ? null : "team-1",
    system_key: system ? id : null,
    created_by_profile_id: system ? null : OTHER,
    updated_by_profile_id: system ? null : OTHER,
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    ...overrides,
  }
}

const TS = tag("TS", "training")
const ESSAY = tag("Esej", "reading")
const OLD = tag("old", "practise", { created_at: "2026-09-01T10:00:00Z" })
const FRESH = tag("fresh", "project", { created_at: "2026-10-05T10:00:00Z" })
const MINE = tag("mine", "project", { created_at: "2026-10-05T10:00:00Z", created_by_profile_id: ME })
const SHOWN = tag("shown", "practise", { created_at: "2026-10-05T10:00:00Z" })
const ALL = [TS, ESSAY, OLD, FRESH, MINE, SHOWN]

describe("direction rules", () => {
  it("requires a tag only for Training and Reading", () => {
    expect(isTagRequired("training")).toBe(true)
    expect(isTagRequired("reading")).toBe(true)
    expect(isTagRequired("practise")).toBe(false)
    expect(isTagRequired("project")).toBe(false)
  })

  it("has team tags only for Practise and Projekt", () => {
    expect(hasTeamTags("practise")).toBe(true)
    expect(hasTeamTags("project")).toBe(true)
    expect(hasTeamTags("training")).toBe(false)
  })
})

describe("listNewTeamTags", () => {
  it("lists hidden team tags created by others after the last review", () => {
    const result = listNewTeamTags({
      tags: ALL,
      selectedTagIds: new Set([SHOWN.id]),
      reviewedAt: "2026-10-02T00:00:00Z",
      profileId: ME,
    })
    expect(result.map((t) => t.id)).toEqual(["fresh"])
  })

  it("lists every hidden team tag of others when never reviewed", () => {
    const result = listNewTeamTags({ tags: ALL, selectedTagIds: new Set(), reviewedAt: null, profileId: ME })
    expect(result.map((t) => t.id)).toEqual(["old", "fresh", "shown"])
  })
})

describe("pickerTags", () => {
  it("offers system tags for Training / Reading", () => {
    expect(pickerTags({ tags: ALL, selectedTagIds: new Set(), direction: "reading" })).toEqual([ESSAY])
  })

  it("offers only shown team tags, plus the entry's current tag", () => {
    const selectedTagIds = new Set([SHOWN.id])
    expect(pickerTags({ tags: ALL, selectedTagIds, direction: "practise" })).toEqual([SHOWN])
    expect(pickerTags({ tags: ALL, selectedTagIds, direction: "practise", currentTagId: OLD.id })).toEqual([
      OLD,
      SHOWN,
    ])
  })
})

describe("findTeamTagByName", () => {
  it("matches team tags of the direction ignoring case and spaces", () => {
    expect(findTeamTagByName(ALL, "project", "  FRESH ")).toBe(FRESH)
    expect(findTeamTagByName(ALL, "practise", "fresh")).toBeUndefined()
    expect(findTeamTagByName(ALL, "training", "ts")).toBeUndefined()
  })

  it("normalizes like the DB unique index", () => {
    expect(normalizeTagName("  Fellaship ")).toBe("fellaship")
  })
})
