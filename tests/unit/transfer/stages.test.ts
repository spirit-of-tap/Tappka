import { describe, expect, it } from "vitest";

import type { Tables } from "@/lib/supabase/database.types";

import { buildProfileMap } from "../../../scripts/transfer/profile-map";
import { buildTeamMap } from "../../../scripts/transfer/team-map";
import type { DataTable, TransferPlan } from "../../../scripts/transfer/preflight";
import { inFilter } from "../../../scripts/transfer/rollback";
import { buildBookInsertRows } from "../../../scripts/transfer/stage-catalog";
import {
  buildCommentInsertRows,
  buildEssayInsertRows,
  buildRevisionInsertRows,
} from "../../../scripts/transfer/stage-essays";
import { buildProfileInsertRows } from "../../../scripts/transfer/stage-profiles";
import { collectAllObjectPaths } from "../../../scripts/transfer/stage-storage";
import { compareCounts, expectedProfileCount } from "../../../scripts/transfer/verify";

const FROM = "http://127.0.0.1:54321/storage/v1/object/public/images";
const TO = "https://preview.supabase.co/storage/v1/object/public/images";

const ZERO_COUNTS: Record<DataTable, number> = {
  books: 0,
  tags: 0,
  book_tags: 0,
  essays: 0,
  essay_revisions: 0,
  essay_comments: 0,
};

function profile(overrides: Partial<Tables<"profiles">>): Tables<"profiles"> {
  return {
    id: "p1",
    name: "Somebody",
    picture: null,
    user_id: null,
    work_email: "somebody@studenti.czu.cz",
    role: "student",
    team_id: null,
    phone_number: null,
    personal_email: null,
    date_of_birth: null,
    access_removed_at: null,
    access_removed_by_profile_id: null,
    beta_access_granted_at: null,
    created_at: "2020-01-01T00:00:00+00:00",
    updated_at: "2020-01-02T00:00:00+00:00",
    created_by_profile_id: null,
    updated_by_profile_id: null,
    ...overrides,
  };
}

const SYSTEM = profile({
  id: "sys",
  name: "System",
  work_email: "admin@studenti.czu.cz",
  role: "admin",
});

const STUDENT = profile({
  id: "stu",
  work_email: "xnovy001@studenti.czu.cz",
  created_by_profile_id: "sys",
  updated_by_profile_id: "sys",
  user_id: "local-user-1",
  created_at: "2021-05-05T10:00:00+00:00",
  updated_at: "2021-05-06T10:00:00+00:00",
});

const REUSED = profile({
  id: "src-kulo",
  work_email: "xkulo007@studenti.czu.cz",
  role: "student",
  team_id: "team-1",
});

const TARGET_KULO = profile({
  id: "tgt-kulo",
  work_email: "xkulo007@studenti.czu.cz",
  role: "admin",
});

const SOURCE_TEAMS = [
  { id: "team-1", name: "Tuuli" },
] as unknown as Tables<"teams">[];

function makePlan(): TransferPlan {
  const sourceProfiles = [STUDENT, SYSTEM, REUSED];
  const targetProfiles = [TARGET_KULO];
  return {
    sourceProfiles,
    targetProfiles,
    profileMap: buildProfileMap(sourceProfiles, targetProfiles),
    sourceTeams: SOURCE_TEAMS,
    teamMap: buildTeamMap(SOURCE_TEAMS, [{ id: "team-1", name: "Tuuli" }]),
    sourceCounts: ZERO_COUNTS,
    targetCounts: ZERO_COUNTS,
  };
}

describe("buildProfileInsertRows", () => {
  it("excludes profiles that already exist in the target (R3)", () => {
    const ids = buildProfileInsertRows(makePlan()).map((row) => row.id);

    expect(ids).not.toContain("src-kulo");
    expect([...ids].sort()).toEqual(["stu", "sys"]);
  });

  it("puts the System profile first, since other rows reference it", () => {
    expect(buildProfileInsertRows(makePlan())[0].id).toBe("sys");
  });

  it("preserves created_at and updated_at (R1)", () => {
    const row = buildProfileInsertRows(makePlan()).find((r) => r.id === "stu");

    expect(row?.created_at).toBe("2021-05-05T10:00:00+00:00");
    expect(row?.updated_at).toBe("2021-05-06T10:00:00+00:00");
  });

  it("forces user_id to null (R7)", () => {
    expect(buildProfileInsertRows(makePlan()).find((r) => r.id === "stu")?.user_id).toBeNull();
  });

  it("remaps audit columns through the profile map", () => {
    const row = buildProfileInsertRows(makePlan()).find((r) => r.id === "stu");

    expect(row?.created_by_profile_id).toBe("sys");
    expect(row?.updated_by_profile_id).toBe("sys");
  });
});

const BOOK = {
  id: "b1",
  created_by_profile_id: "sys",
  updated_by_profile_id: "src-kulo",
  status_changed_by_profile_id: "src-kulo",
  created_at: "2019-10-23T08:00:00+00:00",
  updated_at: "2019-10-24T08:00:00+00:00",
} as Tables<"books">;

describe("buildBookInsertRows", () => {
  it("remaps a colliding audit profile id to the target id", () => {
    const [row] = buildBookInsertRows([BOOK], makePlan());

    expect(row.updated_by_profile_id).toBe("tgt-kulo");
    expect(row.status_changed_by_profile_id).toBe("tgt-kulo");
  });

  it("leaves a non-colliding audit profile id alone", () => {
    expect(buildBookInsertRows([BOOK], makePlan())[0].created_by_profile_id).toBe("sys");
  });

  it("preserves created_at and updated_at (R1)", () => {
    const [row] = buildBookInsertRows([BOOK], makePlan());

    expect(row.created_at).toBe("2019-10-23T08:00:00+00:00");
    expect(row.updated_at).toBe("2019-10-24T08:00:00+00:00");
  });

  it("passes a null status_changed_by_profile_id through", () => {
    const rows = buildBookInsertRows(
      [{ ...BOOK, status_changed_by_profile_id: null }],
      makePlan(),
    );

    expect(rows[0].status_changed_by_profile_id).toBeNull();
  });
});

const ESSAY = {
  id: "e1",
  external_id: "1897",
  author_profile_id: "src-kulo",
  book_id: null,
  published_at: "2019-10-23T08:00:00+00:00",
  pinned_at: null,
  pinned_by_profile_id: null,
  removed_at: null,
  created_at: "2019-10-23T08:00:00+00:00",
  updated_at: "2019-10-23T09:00:00+00:00",
  created_by_profile_id: "sys",
  updated_by_profile_id: "sys",
} as Tables<"essays">;

describe("buildEssayInsertRows", () => {
  it("remaps the author to the existing target profile", () => {
    expect(buildEssayInsertRows([ESSAY], makePlan())[0].author_profile_id).toBe("tgt-kulo");
  });

  it("preserves created_at and updated_at (R1)", () => {
    const [row] = buildEssayInsertRows([ESSAY], makePlan());

    expect(row.created_at).toBe("2019-10-23T08:00:00+00:00");
    expect(row.updated_at).toBe("2019-10-23T09:00:00+00:00");
  });

  it("keeps the primary key and external_id", () => {
    const [row] = buildEssayInsertRows([ESSAY], makePlan());

    expect(row.id).toBe("e1");
    expect(row.external_id).toBe("1897");
  });

  it("passes a null pinned_by_profile_id through", () => {
    expect(buildEssayInsertRows([ESSAY], makePlan())[0].pinned_by_profile_id).toBeNull();
  });
});

const REVISION = {
  essay_id: "e1",
  revision_no: 1,
  title: "T",
  content_json: {
    content: [
      { type: "image", attrs: { src: `${FROM}/essay-images/import/1897/a.png` } },
      { type: "image", attrs: { src: "https://example.com/keep.png" } },
      { type: "image", attrs: { src: "/forpsi-errors/images/logo.gif" } },
    ],
  },
  invalid_since: null,
  created_at: "2019-10-23T08:00:00+00:00",
  updated_at: "2019-10-23T08:00:00+00:00",
  created_by_profile_id: "sys",
  updated_by_profile_id: "src-kulo",
} as Tables<"essay_revisions">;

interface RevisionContent {
  readonly content: readonly { readonly attrs: { readonly src: string } }[];
}

describe("buildRevisionInsertRows", () => {
  it("rewrites local srcs and counts them", () => {
    const { rows, rewritten } = buildRevisionInsertRows([REVISION], makePlan(), FROM, TO);
    const content = rows[0].content_json as unknown as RevisionContent;

    expect(content.content[0].attrs.src).toBe(`${TO}/essay-images/import/1897/a.png`);
    expect(rewritten).toBe(1);
  });

  it("leaves external and junk srcs byte-identical (R5)", () => {
    const { rows } = buildRevisionInsertRows([REVISION], makePlan(), FROM, TO);
    const content = rows[0].content_json as unknown as RevisionContent;

    expect(content.content[1].attrs.src).toBe("https://example.com/keep.png");
    expect(content.content[2].attrs.src).toBe("/forpsi-errors/images/logo.gif");
  });

  it("remaps audit columns and preserves the composite key", () => {
    const { rows } = buildRevisionInsertRows([REVISION], makePlan(), FROM, TO);

    expect(rows[0].updated_by_profile_id).toBe("tgt-kulo");
    expect(rows[0].created_by_profile_id).toBe("sys");
    expect(rows[0].essay_id).toBe("e1");
    expect(rows[0].revision_no).toBe(1);
  });

  it("preserves created_at (R1)", () => {
    const { rows } = buildRevisionInsertRows([REVISION], makePlan(), FROM, TO);

    expect(rows[0].created_at).toBe("2019-10-23T08:00:00+00:00");
  });
});

describe("buildCommentInsertRows", () => {
  const COMMENT = {
    id: "c1",
    essay_id: "e1",
    author_profile_id: "src-kulo",
    body: "hi",
    removed_at: null,
    created_at: "2020-01-01T00:00:00+00:00",
    updated_at: "2020-01-01T00:00:00+00:00",
    created_by_profile_id: "sys",
    updated_by_profile_id: "sys",
  } as Tables<"essay_comments">;

  it("remaps the author and preserves timestamps", () => {
    const [row] = buildCommentInsertRows([COMMENT], makePlan());

    expect(row.author_profile_id).toBe("tgt-kulo");
    expect(row.created_at).toBe("2020-01-01T00:00:00+00:00");
  });
});

describe("collectAllObjectPaths", () => {
  it("deduplicates paths across revisions and ignores non-local srcs", () => {
    const revisions = [
      { content_json: { attrs: { src: `${FROM}/a/1.png` } } },
      { content_json: { attrs: { src: `${FROM}/a/1.png` } } },
      { content_json: { attrs: { src: `${FROM}/b/2.png` } } },
      { content_json: { attrs: { src: "https://example.com/x.png" } } },
    ] as Pick<Tables<"essay_revisions">, "content_json">[];

    expect(collectAllObjectPaths(revisions, FROM).sort()).toEqual(["a/1.png", "b/2.png"]);
  });

  it("returns an empty list for no revisions", () => {
    expect(collectAllObjectPaths([], FROM)).toEqual([]);
  });
});

describe("compareCounts", () => {
  const SOURCE: Record<DataTable, number> = {
    books: 618,
    tags: 8,
    book_tags: 616,
    essays: 6595,
    essay_revisions: 6595,
    essay_comments: 220,
  };

  it("passes when every table matches", () => {
    expect(compareCounts(SOURCE, { ...SOURCE }).every((check) => check.passed)).toBe(true);
  });

  it("fails the specific table that differs", () => {
    const failed = compareCounts(SOURCE, { ...SOURCE, essays: 6594 }).filter((c) => !c.passed);

    expect(failed).toHaveLength(1);
    expect(failed[0].name).toBe("count:essays");
    expect(failed[0].detail).toContain("6595");
    expect(failed[0].detail).toContain("6594");
  });

  it("returns one check per data table", () => {
    expect(compareCounts(SOURCE, { ...SOURCE })).toHaveLength(6);
  });
});

describe("inFilter", () => {
  it("builds a PostgREST in.() filter", () => {
    expect(inFilter("id", ["a", "b"])).toBe("id=in.(a,b)");
  });

  it("quotes ids defensively so a stray comma cannot widen the filter", () => {
    expect(inFilter("id", ["a,b"])).toBe('id=in.("a,b")');
  });

  it("rejects an empty id list, which would otherwise delete nothing silently", () => {
    expect(() => inFilter("id", [])).toThrow(/empty/i);
  });
});

describe("expectedProfileCount", () => {
  it("equals the source count when every target profile collides", () => {
    // Preview's shape: all 3 target profiles exist in the source.
    expect(expectedProfileCount(makePlan())).toBe(3);
  });

  it("adds target-only accounts that have no source counterpart", () => {
    // Production's shape: real staff accounts absent from the legacy import
    // must not make a correct transfer look wrong.
    const plan = makePlan();
    const withStranger: TransferPlan = {
      ...plan,
      targetProfiles: [
        ...plan.targetProfiles,
        profile({ id: "tgt-only", work_email: "staff@pef.czu.cz", role: "mentor" }),
      ],
    };

    expect(expectedProfileCount(withStranger)).toBe(4);
  });
});
