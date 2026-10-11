import { describe, expect, it } from "vitest"

import {
  DEFAULT_REPORT_SERIES,
  availableSeries,
  buildReportRows,
  directionSeriesKey,
  entriesToCsv,
  reportRowsToCsv,
  tagSeriesKey,
  toCsv,
} from "./report"
import type { TeamMember, TimeDirection, TimeEntryWithTag, TimeTag } from "./types"

const HOUR = 3_600_000
const RANGE = { from: new Date("2026-10-05T00:00:00Z"), to: new Date("2026-10-12T00:00:00Z") }
const NOW = new Date("2026-10-11T12:00:00Z")

const ANNA: TeamMember = { id: "p-anna", name: "Anna Nováková", picture: null }
const BEDA: TeamMember = { id: "p-beda", name: "Béďa, \"Kapitán\"", picture: null }

const FELLA: TimeTag = {
  id: "t-fella",
  name: "Fellaship",
  direction: "practise",
  team_id: "team-1",
  system_key: null,
  created_by_profile_id: ANNA.id,
  updated_by_profile_id: ANNA.id,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
}
const TS: TimeTag = { ...FELLA, id: "t-ts", name: "TS", direction: "training", team_id: null, system_key: "training_session" }

let seq = 0
function entry(
  profileId: string,
  direction: TimeDirection,
  startedAt: string,
  hours: number | null,
  tag: TimeTag | null = null,
): TimeEntryWithTag {
  seq += 1
  const endedAt = hours === null ? null : new Date(Date.parse(startedAt) + hours * HOUR).toISOString()
  return {
    id: `e${seq}`,
    profile_id: profileId,
    direction,
    tag_id: tag?.id ?? null,
    tag: tag === null ? null : { id: tag.id, name: tag.name, direction: tag.direction },
    title: null,
    started_at: startedAt,
    ended_at: endedAt,
    duration_ms: hours === null ? null : hours * HOUR,
    source: "manual",
    attendance_id: null,
    created_at: startedAt,
    updated_at: startedAt,
    created_by_profile_id: profileId,
    updated_by_profile_id: profileId,
  }
}

const ENTRIES = [
  entry(ANNA.id, "practise", "2026-10-06T08:00:00Z", 2, FELLA),
  entry(ANNA.id, "practise", "2026-10-06T12:00:00Z", 1.5),
  entry(ANNA.id, "training", "2026-10-07T08:00:00Z", 4, TS),
  // Starts before the range: only the part inside counts.
  entry(BEDA.id, "practise", "2026-10-04T23:00:00Z", 3, FELLA),
  // Running timer: counts until NOW.
  entry(BEDA.id, "reading", "2026-10-11T11:00:00Z", null),
]

describe("availableSeries", () => {
  it("lists the four directions, then tags grouped by direction", () => {
    expect(availableSeries([FELLA, TS]).map((series) => series.key)).toEqual([
      "direction:training",
      "direction:reading",
      "direction:practise",
      "direction:project",
      "tag:t-ts",
      "tag:t-fella",
    ])
  })
})

describe("buildReportRows", () => {
  it("sums hours per member for directions, clipped to the range and with running timers", () => {
    const rows = buildReportRows({ members: [ANNA, BEDA], entries: ENTRIES, series: DEFAULT_REPORT_SERIES, range: RANGE, now: NOW })
    expect(rows[0]).toMatchObject({
      memberName: "Anna Nováková",
      hours: { "direction:training": 4, "direction:reading": 0, "direction:practise": 3.5, "direction:project": 0 },
      totalHours: 7.5,
    })
    expect(rows[1]).toMatchObject({
      hours: { "direction:practise": 2, "direction:reading": 1 },
      totalHours: 3,
    })
  })

  it("sums a single tag and keeps members without time as zero rows", () => {
    const silent: TeamMember = { id: "p-silent", name: "Cyril", picture: null }
    const rows = buildReportRows({
      members: [ANNA, BEDA, silent],
      entries: ENTRIES,
      series: [tagSeriesKey(FELLA.id)],
      range: RANGE,
      now: NOW,
    })
    expect(rows.map((row) => row.hours["tag:t-fella"])).toEqual([2, 2, 0])
    expect(rows[2].totalHours).toBe(0)
  })
})

describe("CSV export", () => {
  it("quotes cells with separators and quotes and starts with a BOM", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"']])).toBe('﻿a,b\r\n"x,y","say ""hi"""\r\n')
  })

  it("exports chart rows with labelled hour columns", () => {
    const series = availableSeries([FELLA])
    const keys = [directionSeriesKey("practise"), tagSeriesKey(FELLA.id)]
    const rows = buildReportRows({ members: [ANNA], entries: ENTRIES, series: keys, range: RANGE, now: NOW })
    expect(reportRowsToCsv(rows, keys, series)).toBe(
      "﻿Člen:ka,Practise (h),Fellaship (h),Celkem (h)\r\nAnna Nováková,3.5,2,5.5\r\n",
    )
  })

  it("exports raw entries oldest first with Prague times", () => {
    const csv = entriesToCsv({ members: [ANNA, BEDA], entries: [ENTRIES[2], ENTRIES[0]], now: NOW })
    const lines = csv.replace("﻿", "").trim().split("\r\n")
    expect(lines[0]).toBe("Datum,Člen:ka,Směr,Tag,Co konkrétně,Začátek,Konec,Hodiny")
    expect(lines[1]).toBe("2026-10-06,Anna Nováková,Practise,Fellaship,,2026-10-06 10:00,2026-10-06 12:00,2")
    expect(lines[2]).toBe("2026-10-07,Anna Nováková,Training,TS,,2026-10-07 10:00,2026-10-07 14:00,4")
  })
})
