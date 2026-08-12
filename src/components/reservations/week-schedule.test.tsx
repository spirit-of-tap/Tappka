import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { WeekSchedule } from "@/components/reservations/week-schedule";

describe("WeekSchedule past-slot blocking", () => {
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

  it("renders a solid block in today's column up to the current slot", () => {
    const weekStart = new Date(2026, 7, 10); // Monday of 2026-08-12
    const { container } = render(<WeekSchedule startDate={weekStart} reservations={[]} />);

    // Today is the 3rd column (Mon=1, Tue=2, Wed=3)
    const columns = Array.from(container.querySelectorAll("[class*='flex-1 relative border-r']"));
    const todayColumn = columns[2];

    // 07:00 -> 10:00 = 3h * 48px/h
    const solid = solidBlock(todayColumn as HTMLElement);
    expect(solid).not.toBeNull();
    expect(solid).toHaveStyle({ height: "144px" });
  });

  it("renders no solid block in other days' columns", () => {
    const weekStart = new Date(2026, 7, 10);
    const { container } = render(<WeekSchedule startDate={weekStart} reservations={[]} />);

    const columns = Array.from(container.querySelectorAll("[class*='flex-1 relative border-r']"));
    expect(solidBlock(columns[0] as HTMLElement)).toBeNull();
    expect(solidBlock(columns[1] as HTMLElement)).toBeNull();
    expect(solidBlock(columns[4] as HTMLElement)).toBeNull();
  });
});
