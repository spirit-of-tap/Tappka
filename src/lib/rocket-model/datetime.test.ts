import { describe, expect, it } from "vitest";

import { formatRocketDateTime } from "./datetime";

describe("formatRocketDateTime", () => {
  it("formats a local date in Czech short form with time", () => {
    expect(formatRocketDateTime(new Date(2026, 8, 10, 8, 5))).toBe("10. 9. 2026 8:05");
  });

  it("pads minutes but not hours", () => {
    expect(formatRocketDateTime(new Date(2026, 0, 2, 15, 0))).toBe("2. 1. 2026 15:00");
  });
});
