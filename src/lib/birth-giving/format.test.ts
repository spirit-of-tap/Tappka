import { describe, expect, it } from "vitest";

import { formatFileSize } from "./format";

describe("formatFileSize", () => {
  it("formats bytes without a decimal suffix", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(999)).toBe("999 B");
  });

  it("formats kilobytes with one decimal place", () => {
    expect(formatFileSize(1_000)).toBe("1 KB");
    expect(formatFileSize(1_500)).toBe("1.5 KB");
    expect(formatFileSize(999_999)).toBe("1000 KB");
  });

  it("formats megabytes with one decimal place", () => {
    expect(formatFileSize(1_000_000)).toBe("1 MB");
    expect(formatFileSize(1_500_000)).toBe("1.5 MB");
    expect(formatFileSize(25_000_000)).toBe("25 MB");
  });
});
