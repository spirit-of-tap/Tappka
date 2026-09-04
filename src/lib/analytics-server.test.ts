import { describe, expect, it, vi } from "vitest";

import { trackServer } from "./analytics-server";

const captureImmediate = vi.fn();

vi.mock("./posthog-server", () => ({
  getPostHogServer: () => ({ captureImmediate }),
}));

describe("trackServer", () => {
  it("forwards event with distinctId and props", async () => {
    await trackServer("feature_interaction", "user-1", {
      feature: "reservations",
      action: "created",
    });
    expect(captureImmediate).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "user-1",
        event: "feature_interaction",
      }),
    );
  });
});
