import { afterEach, describe, expect, it, vi } from "vitest";

import { buildEndpoint } from "../../../scripts/transfer/config";
import {
  contentTypeFor,
  downloadObject,
  encodeObjectPath,
  headObject,
  mapWithConcurrency,
  uploadObject,
} from "../../../scripts/transfer/storage";

const ENDPOINT = buildEndpoint("https://x.supabase.co", "svc-key");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("encodeObjectPath", () => {
  it("keeps slashes but encodes each segment", () => {
    expect(encodeObjectPath("essay-images/import/a b/c+d.png")).toBe(
      "essay-images/import/a%20b/c%2Bd.png",
    );
  });

  it("leaves a plain path untouched", () => {
    expect(encodeObjectPath("essay-images/import/1897/Image_910.png")).toBe(
      "essay-images/import/1897/Image_910.png",
    );
  });
});

describe("contentTypeFor", () => {
  it("maps known image extensions case-insensitively", () => {
    expect(contentTypeFor("a.JPG")).toBe("image/jpeg");
    expect(contentTypeFor("a.jpeg")).toBe("image/jpeg");
    expect(contentTypeFor("a.png")).toBe("image/png");
    expect(contentTypeFor("a.gif")).toBe("image/gif");
    expect(contentTypeFor("a.webp")).toBe("image/webp");
  });

  it("falls back to a generic binary type", () => {
    expect(contentTypeFor("a.bin")).toBe("application/octet-stream");
  });
});

describe("headObject", () => {
  it("reports an existing object with its size", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(null, { status: 200, headers: { "Content-Length": "135158" } })),
    );

    await expect(headObject(ENDPOINT, "a/b.png")).resolves.toEqual({
      exists: true,
      size: 135158,
    });
  });

  it("treats HTTP 400 as missing, because Supabase storage returns 400 not 404", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response(null, { status: 400 })));

    await expect(headObject(ENDPOINT, "a/b.png")).resolves.toEqual({
      exists: false,
      size: null,
    });
  });

  it("requests the public URL with HEAD", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`);
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    await headObject(ENDPOINT, "a/b.png");

    expect(calls[0]).toBe(
      "HEAD https://x.supabase.co/storage/v1/object/public/images/a/b.png",
    );
  });
});

describe("downloadObject", () => {
  it("returns bytes and the served content type", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      ),
    );

    const result = await downloadObject(ENDPOINT, "a/b.png");

    expect([...result.bytes]).toEqual([1, 2, 3]);
    expect(result.contentType).toBe("image/png");
  });

  it("falls back to the extension when no content type is served", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(new Uint8Array([1]), { status: 200 })),
    );

    await expect(
      downloadObject(ENDPOINT, "a/b.gif").then((r) => r.contentType),
    ).resolves.toBe("image/gif");
  });

  it("throws when the source object is missing", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("gone", { status: 400 })));

    await expect(downloadObject(ENDPOINT, "a/b.png")).rejects.toThrow(/a\/b\.png[\s\S]*400/);
  });
});

describe("uploadObject", () => {
  it("POSTs to the object API with upsert enabled", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(null, { status: 200 }));
    });

    await uploadObject(ENDPOINT, "a/b.png", new Uint8Array([1]), "image/png");
    const headers = calls[0].init.headers as Record<string, string>;

    expect(calls[0].url).toBe("https://x.supabase.co/storage/v1/object/images/a/b.png");
    expect(calls[0].init.method).toBe("POST");
    expect(headers["x-upsert"]).toBe("true");
    expect(headers["Content-Type"]).toBe("image/png");
    expect(headers.Authorization).toBe("Bearer svc-key");
  });

  it("throws on a failed upload", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("denied", { status: 403 })));

    await expect(
      uploadObject(ENDPOINT, "a/b.png", new Uint8Array([1]), "image/png"),
    ).rejects.toThrow(/403[\s\S]*denied/);
  });
});

describe("mapWithConcurrency", () => {
  it("preserves input order in the results", async () => {
    const result = await mapWithConcurrency([3, 1, 2], 2, async (n) => {
      await new Promise((resolve) => setTimeout(resolve, n));
      return n * 10;
    });

    expect(result).toEqual([30, 10, 20]);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;

    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return null;
    });

    expect(peak).toBeLessThanOrEqual(4);
  });

  it("handles an empty input", async () => {
    await expect(mapWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
  });
});
