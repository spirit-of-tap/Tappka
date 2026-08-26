import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { birthGivingMutationRequest } from "./mutation";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("birthGivingMutationRequest", () => {
  it("posts a JSON body to the given path", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "event-1" } }),
    });

    await birthGivingMutationRequest("/api/birth-giving/events/event-1/teams", {
      body: { name: "Tým Alfa" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/birth-giving/events/event-1/teams",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tým Alfa" }),
      }),
    );
  });

  it("supports other HTTP methods without a body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await birthGivingMutationRequest(
      "/api/birth-giving/events/event-1/publish",
      { method: "POST" },
    );

    expect(result.ok).toBe(true);
  });

  it("tolerates a non-JSON error body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });

    const result = await birthGivingMutationRequest("/api/birth-giving/events");

    expect(result.ok).toBe(false);
    expect(result.body.error).toBeUndefined();
  });
});