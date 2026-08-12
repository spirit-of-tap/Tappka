import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { DaySchedule } from "@/components/reservations/day-schedule";

describe("DaySchedule past-slot blocking", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Wednesday 2026-08-12, 10:00 local — operating hours start at 07:00
    vi.setSystemTime(new Date(2026, 7, 12, 10, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const solidBlock = (container: HTMLElement) =>
    container.querySelector(".bg-muted\\/40.cursor-not-allowed");

  it("renders a solid block for today's elapsed slots, ending at the current slot", () => {
    const today = new Date(2026, 7, 12, 10, 0, 0, 0);
    const { container } = render(<DaySchedule date={today} reservations={[]} />);

    // 07:00 -> end of last past slot (09:45 + 15 min) = 10:00 -> 3h * 60px/h
    const solid = solidBlock(container);
    expect(solid).not.toBeNull();
    expect(solid).toHaveStyle({ height: "180px" });
  });

  it("keeps the current 15-min slot outside the solid block", () => {
    // 09:50 -> grace boundary 09:35 -> last past slot 09:30 -> solid ends 09:45
    vi.setSystemTime(new Date(2026, 7, 12, 9, 50, 0, 0));
    const today = new Date(2026, 7, 12, 9, 50, 0, 0);
    const { container } = render(<DaySchedule date={today} reservations={[]} />);

    // (09:45 - 07:00) = 2.75h * 60px/h = 165px
    expect(solidBlock(container)).toHaveStyle({ height: "165px" });
  });

  it("renders no solid block for a future day", () => {
    const future = new Date(2026, 7, 13, 10, 0, 0, 0);
    const { container } = render(<DaySchedule date={future} reservations={[]} />);

    expect(solidBlock(container)).toBeNull();
  });

  it("renders no solid block outside operating hours", () => {
    // Before opening: boundary is before 07:00 -> height clamps to 0
    vi.setSystemTime(new Date(2026, 7, 12, 5, 30, 0, 0));
    const today = new Date(2026, 7, 12, 5, 30, 0, 0);
    const { container } = render(<DaySchedule date={today} reservations={[]} />);

    expect(solidBlock(container)).toBeNull();
  });

  it("fills the whole grid with a solid block on a past day", () => {
    const yesterday = new Date(2026, 7, 11, 10, 0, 0, 0);
    const { container } = render(<DaySchedule date={yesterday} reservations={[]} />);

    // Past day: grid rows are replaced by a single full-height block (15h * 60px)
    expect(container.querySelector(".h-full")).not.toBeNull();
  });
});
