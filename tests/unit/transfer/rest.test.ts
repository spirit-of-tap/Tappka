import { afterEach, describe, expect, it, vi } from "vitest";

import { buildEndpoint } from "../../../scripts/transfer/config";
import {
  chunk,
  countRows,
  deleteRows,
  insertRows,
  patchRows,
  selectAll,
} from "../../../scripts/transfer/rest";

const ENDPOINT = buildEndpoint("https://x.supabase.co", "svc-key");

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit;
}

function stubFetch(responses: readonly Response[]): FetchCall[] {
  const calls: FetchCall[] = [];
  let index = 0;
  vi.stubGlobal("fetch", (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return Promise.resolve(response);
  });
  return calls;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chunk", () => {
  it("splits into fixed-size batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns an empty array for no items", () => {
    expect(chunk([], 10)).toEqual([]);
  });
});

describe("selectAll", () => {
  it("stops after a short page", async () => {
    const calls = stubFetch([jsonResponse([{ id: "a" }])]);

    await expect(selectAll(ENDPOINT, "teams")).resolves.toEqual([{ id: "a" }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/rest/v1/teams?select=*");
    expect(calls[0].url).toContain("offset=0");
  });

  it("pages until a short page arrives", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: String(i) }));
    const calls = stubFetch([jsonResponse(full), jsonResponse([{ id: "last" }])]);

    const rows = await selectAll<{ id: string }>(ENDPOINT, "essays");

    expect(rows).toHaveLength(1001);
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain("offset=1000");
  });

  it("sends the service key on both headers", async () => {
    const calls = stubFetch([jsonResponse([])]);
    await selectAll(ENDPOINT, "teams");
    const headers = calls[0].init.headers as Record<string, string>;

    expect(headers.apikey).toBe("svc-key");
    expect(headers.Authorization).toBe("Bearer svc-key");
  });

  it("throws with status and body on failure", async () => {
    stubFetch([new Response("nope", { status: 401 })]);

    await expect(selectAll(ENDPOINT, "teams")).rejects.toThrow(/401.*nope/s);
  });
});

describe("countRows", () => {
  it("parses the total out of content-range", async () => {
    stubFetch([
      jsonResponse([], { headers: { "Content-Range": "0-0/6595" } }),
    ]);

    await expect(countRows(ENDPOINT, "essays")).resolves.toBe(6595);
  });

  it("throws when content-range is missing", async () => {
    stubFetch([jsonResponse([])]);

    await expect(countRows(ENDPOINT, "essays")).rejects.toThrow(/content-range/i);
  });
});

describe("insertRows", () => {
  it("never updates existing rows", async () => {
    const calls = stubFetch([new Response(null, { status: 201 })]);
    await insertRows(ENDPOINT, "essays", [{ id: "a" }]);
    const headers = calls[0].init.headers as Record<string, string>;

    expect(headers.Prefer).toBe("return=minimal,resolution=ignore-duplicates");
    expect(headers.Prefer).not.toContain("merge-duplicates");
  });

  it("passes on_conflict for composite keys", async () => {
    const calls = stubFetch([new Response(null, { status: 201 })]);
    await insertRows(ENDPOINT, "essay_revisions", [{ essay_id: "a" }], "essay_id,revision_no");

    expect(calls[0].url).toContain("on_conflict=essay_id%2Crevision_no");
  });

  it("skips the request entirely for zero rows", async () => {
    const calls = stubFetch([new Response(null, { status: 201 })]);
    await insertRows(ENDPOINT, "essays", []);

    expect(calls).toHaveLength(0);
  });

  it("throws on a failed insert", async () => {
    stubFetch([new Response("fk violation", { status: 409 })]);

    await expect(insertRows(ENDPOINT, "essays", [{ id: "a" }])).rejects.toThrow(
      /essays.*409.*fk violation/s,
    );
  });
});

describe("patchRows", () => {
  it("PATCHes with the filter in the query string", async () => {
    const calls = stubFetch([new Response(null, { status: 204 })]);
    await patchRows(ENDPOINT, "profiles", "id=eq.abc", { team_id: "t1" });

    expect(calls[0].init.method).toBe("PATCH");
    expect(calls[0].url).toBe("https://x.supabase.co/rest/v1/profiles?id=eq.abc");
    expect(calls[0].init.body).toBe(JSON.stringify({ team_id: "t1" }));
  });
});

describe("deleteRows", () => {
  it("DELETEs with the filter in the query string", async () => {
    const calls = stubFetch([new Response(null, { status: 204 })]);
    await deleteRows(ENDPOINT, "essays", "id=in.(a,b)");

    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].url).toBe("https://x.supabase.co/rest/v1/essays?id=in.(a,b)");
  });
});
