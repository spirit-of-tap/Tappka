import { describe, expect, it } from "vitest";

import {
  assertTargetEmpty,
  assertTeamsAligned,
  type DataTable,
} from "../../../scripts/transfer/preflight";

const TEAMS = [
  { id: "t1", name: "Aconditor" },
  { id: "t2", name: "BASED" },
];

const EMPTY_COUNTS: Record<DataTable, number> = {
  books: 0,
  tags: 0,
  book_tags: 0,
  essays: 0,
  essay_revisions: 0,
  essay_comments: 0,
};

describe("assertTeamsAligned", () => {
  it("accepts identical teams", () => {
    expect(() => assertTeamsAligned(TEAMS, [...TEAMS].reverse())).not.toThrow();
  });

  it("accepts extra teams in the target", () => {
    expect(() =>
      assertTeamsAligned(TEAMS, [...TEAMS, { id: "t3", name: "Extra" }]),
    ).not.toThrow();
  });

  it("rejects a source team missing from the target", () => {
    expect(() => assertTeamsAligned(TEAMS, [TEAMS[0]])).toThrow(/t2[\s\S]*BASED/);
  });

  it("rejects a team whose name differs, since ids must line up by identity", () => {
    expect(() =>
      assertTeamsAligned(TEAMS, [TEAMS[0], { id: "t2", name: "Renamed" }]),
    ).toThrow(/t2[\s\S]*BASED[\s\S]*Renamed/);
  });
});

describe("assertTargetEmpty", () => {
  it("accepts an empty target", () => {
    expect(() => assertTargetEmpty(EMPTY_COUNTS, false)).not.toThrow();
  });

  it("rejects a non-empty target without --resume, naming the table and count", () => {
    expect(() => assertTargetEmpty({ ...EMPTY_COUNTS, essays: 12 }, false)).toThrow(
      /essays[\s\S]*12[\s\S]*--resume/,
    );
  });

  it("allows a non-empty target with --resume", () => {
    expect(() => assertTargetEmpty({ ...EMPTY_COUNTS, essays: 12 }, true)).not.toThrow();
  });
});
