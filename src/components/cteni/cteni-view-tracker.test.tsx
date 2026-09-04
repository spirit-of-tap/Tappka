import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { trackView } from "@/lib/analytics";

import { CteniViewTracker } from "./cteni-view-tracker";

vi.mock("@/lib/analytics", () => ({ trackView: vi.fn() }));

describe("CteniViewTracker", () => {
  it("tracks cteni view on mount", () => {
    render(<CteniViewTracker />);
    expect(trackView).toHaveBeenCalledWith("cteni");
  });
});
