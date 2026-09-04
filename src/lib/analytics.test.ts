import { describe, expect, it, vi } from "vitest";

import posthog from "posthog-js";

import { trackFeature } from "./analytics";

describe("trackFeature", () => {
  it("captures feature_interaction with allowlisted props", () => {
    const spy = vi
      .spyOn(posthog, "capture")
      .mockImplementation(() => undefined);
    trackFeature("reservations", "created");
    expect(spy).toHaveBeenCalledWith(
      "feature_interaction",
      expect.objectContaining({ feature: "reservations", action: "created" }),
    );
    spy.mockRestore();
  });
});
