import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

beforeEach(() => {
  mockPush.mockReset();
  mockSearchParams.delete("tag");
  mockSearchParams.delete("page");
});

describe("TopicPills", () => {
  it("renders all topic categories", async () => {
    const { TopicPills } = await import("@/components/essays/topic-pills");
    render(<TopicPills />);
    expect(screen.getByText("Finance & ekonomika")).toBeInTheDocument();
    expect(screen.getByText("Osobní rozvoj")).toBeInTheDocument();
    expect(screen.getByText("Leadership")).toBeInTheDocument();
  });

  it("highlights the active tag from search params", async () => {
    mockSearchParams.set("tag", "Leadership");
    const { TopicPills } = await import("@/components/essays/topic-pills");
    render(<TopicPills />);
    const leadershipBtn = screen.getByText("Leadership");
    expect(leadershipBtn.className).toContain("bg-primary");
  });

  it("calls router.push with tag param on pill click", async () => {
    const { TopicPills } = await import("@/components/essays/topic-pills");
    const user = userEvent.setup();
    render(<TopicPills />);
    await user.click(screen.getByText("Leadership"));
    expect(mockPush).toHaveBeenCalledWith("?tag=Leadership");
  });

  it("removes tag when active pill is clicked", async () => {
    mockSearchParams.set("tag", "Leadership");
    const { TopicPills } = await import("@/components/essays/topic-pills");
    const user = userEvent.setup();
    render(<TopicPills />);
    await user.click(screen.getByText("Leadership"));
    expect(mockPush).toHaveBeenCalledWith("?");
  });
});
