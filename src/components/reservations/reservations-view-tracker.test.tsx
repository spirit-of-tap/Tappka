import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { trackView } from "@/lib/analytics";

import { ReservationsViewTracker } from "./reservations-view-tracker";

vi.mock("@/lib/analytics", () => ({ trackView: vi.fn() }));

describe("ReservationsViewTracker", () => {
  it("tracks reservations view on mount", () => {
    render(<ReservationsViewTracker />);
    expect(trackView).toHaveBeenCalledWith("reservations");
  });
});
