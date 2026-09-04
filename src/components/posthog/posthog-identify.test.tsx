import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PostHogIdentify } from "./posthog-identify";

const identify = vi.fn();
const group = vi.fn();

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ identify, group }),
}));

describe("PostHogIdentify", () => {
  it("identifies with role and groups by team", () => {
    render(
      <PostHogIdentify
        distinctId="user-1"
        role="student"
        betaAccess={false}
        betaCohort="A"
        teamId="team-1"
      />,
    );
    expect(identify).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ role: "student" }),
    );
    expect(group).toHaveBeenCalledWith("team", "team-1");
  });

  it("skips group when no team", () => {
    identify.mockClear();
    group.mockClear();
    render(
      <PostHogIdentify
        distinctId="user-2"
        role="coach"
        betaAccess
        betaCohort="B"
        teamId={null}
      />,
    );
    expect(identify).toHaveBeenCalled();
    expect(group).not.toHaveBeenCalled();
  });
});
