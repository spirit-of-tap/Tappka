import { describe, expect, it } from "vitest";

import { buildEndpoint, resolveSource, resolveTarget } from "../../../scripts/transfer/config";

const ENV = {
  LOCAL_SUPABASE_URL: "http://127.0.0.1:54321",
  LOCAL_SERVICE_ROLE_KEY: "local-key",
  PREVIEW_SUPABASE_URL: "https://preview.supabase.co/",
  PREVIEW_SERVICE_ROLE_KEY: "preview-key",
} as unknown as NodeJS.ProcessEnv;

describe("buildEndpoint", () => {
  it("derives rest, storage and public image URLs", () => {
    const endpoint = buildEndpoint("https://x.supabase.co", "k");

    expect(endpoint.restUrl).toBe("https://x.supabase.co/rest/v1");
    expect(endpoint.storageApiUrl).toBe("https://x.supabase.co/storage/v1");
    expect(endpoint.publicImagePrefix).toBe(
      "https://x.supabase.co/storage/v1/object/public/images",
    );
    expect(endpoint.serviceKey).toBe("k");
  });

  it("strips trailing slashes so prefixes never double up", () => {
    expect(buildEndpoint("https://x.supabase.co///", "k").restUrl).toBe(
      "https://x.supabase.co/rest/v1",
    );
  });
});

describe("resolveTarget", () => {
  it("resolves preview from env", () => {
    const target = resolveTarget("preview", ENV);

    expect(target.name).toBe("preview");
    expect(target.publicImagePrefix).toBe(
      "https://preview.supabase.co/storage/v1/object/public/images",
    );
    expect(target.serviceKey).toBe("preview-key");
  });

  it("rejects an unknown target name", () => {
    expect(() => resolveTarget("staging", ENV)).toThrow(/Unknown target "staging"/);
  });

  it("names the missing variable when a key is absent", () => {
    expect(() => resolveTarget("production", ENV)).toThrow(
      /PRODUCTION_SUPABASE_URL/,
    );
  });

  it("treats a blank value as missing", () => {
    expect(() => resolveTarget("preview", { ...ENV, PREVIEW_SERVICE_ROLE_KEY: "   " })).toThrow(
      /PREVIEW_SERVICE_ROLE_KEY/,
    );
  });
});

describe("resolveSource", () => {
  it("resolves the local endpoint", () => {
    expect(resolveSource(ENV).restUrl).toBe("http://127.0.0.1:54321/rest/v1");
  });
});
