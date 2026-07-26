import { describe, expect, it } from "vitest";

import { assertTargetEmpty, type DataTable } from "../../../scripts/transfer/preflight";

const EMPTY_COUNTS: Record<DataTable, number> = {
  books: 0,
  tags: 0,
  book_tags: 0,
  essays: 0,
  essay_revisions: 0,
  essay_comments: 0,
};

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
