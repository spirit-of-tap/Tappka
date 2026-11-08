import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { KasaIcon } from "@/lib/komunitni-kasa/brand/kasa-icon";
import { KASA_MARK_SEGMENTS_PATH } from "@/lib/komunitni-kasa/brand/constants";
import { NAV_MODULES } from "@/lib/navigation";

describe("KasaIcon", () => {
  it("draws the six-segment mark filled with the current text colour", () => {
    const { container } = render(<KasaIcon className="size-4" />);
    const path = container.querySelector("path");
    expect(path?.getAttribute("d")).toBe(KASA_MARK_SEGMENTS_PATH);
    expect(path?.getAttribute("fill")).toBe("currentColor");
    expect(container.querySelector("circle")?.getAttribute("fill")).toBe("currentColor");
  });

  it("is the icon of the Komunitní kasa menu entry", () => {
    expect(NAV_MODULES.find((item) => item.url === "/komunitni-kasa")?.icon).toBe(KasaIcon);
  });
});
