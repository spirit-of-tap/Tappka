import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonalProgress } from "@/components/essays/personal-progress";

describe("PersonalProgress", () => {
  it("shows the approved points out of goal", () => {
    render(<PersonalProgress approved_points={30} pending_points={5} />);
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("/ 120 b.")).toBeInTheDocument();
  });

  it("shows the next milestone when not yet at goal", () => {
    render(<PersonalProgress approved_points={30} pending_points={5} />);
    expect(screen.getByText(/ještě 10 b\./)).toBeInTheDocument();
  });

  it("shows goal reached message when at or above goal", () => {
    render(<PersonalProgress approved_points={120} pending_points={0} />);
    expect(screen.getByText("Cíl splněn! 🎉")).toBeInTheDocument();
  });

  it("shows goal reached when above goal", () => {
    render(<PersonalProgress approved_points={150} pending_points={0} />);
    expect(screen.getByText("Cíl splněn! 🎉")).toBeInTheDocument();
  });

  it("renders progress bar with correct percentage", () => {
    const { container } = render(<PersonalProgress approved_points={60} pending_points={0} />);
    const bar = container.querySelector("[style*='width: 50%']");
    expect(bar).toBeInTheDocument();
  });
});
