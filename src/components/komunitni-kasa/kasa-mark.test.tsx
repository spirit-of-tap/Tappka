import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { KASA_COLORS } from "@/lib/komunitni-kasa/brand/constants";
import { KasaMark } from "./kasa-mark";

describe("KasaMark", () => {
  it("renders the six segments and the coin", () => {
    const { container } = render(<KasaMark />);
    expect(container.querySelectorAll("path")).toHaveLength(1);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });

  it("is decorative without a title", () => {
    const { container } = render(<KasaMark />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("is an image with a title when given", () => {
    const { container } = render(<KasaMark title="Komunitní kasa" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-hidden")).toBeNull();
    expect(container.querySelector("title")?.textContent).toBe("Komunitní kasa");
  });

  it("uses the brand red by default and currentColor in current tone", () => {
    const brand = render(<KasaMark />).container.querySelector("path");
    expect(brand?.getAttribute("fill")).toBe(KASA_COLORS.RED);
    const current = render(<KasaMark tone="current" />).container.querySelector("path");
    expect(current?.getAttribute("fill")).toBe("currentColor");
  });
});
