import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import posthog from "posthog-js";

import { ConsentBanner } from "./consent-banner";

vi.mock("posthog-js", () => ({
  default: {
    get_explicit_consent_status: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}));

const mockedPosthog = vi.mocked(posthog);

describe("ConsentBanner", () => {
  it("calls opt_in on accept", async () => {
    mockedPosthog.get_explicit_consent_status.mockReturnValue("pending");
    const user = userEvent.setup();
    render(<ConsentBanner />);
    await user.click(screen.getByRole("button", { name: /přijmout/i }));
    expect(mockedPosthog.opt_in_capturing).toHaveBeenCalledOnce();
  });

  it("calls opt_out on decline", async () => {
    mockedPosthog.get_explicit_consent_status.mockReturnValue("pending");
    const user = userEvent.setup();
    render(<ConsentBanner />);
    await user.click(screen.getByRole("button", { name: /odmítnout/i }));
    expect(mockedPosthog.opt_out_capturing).toHaveBeenCalledOnce();
  });

  it("hides when consent already decided", () => {
    mockedPosthog.get_explicit_consent_status.mockReturnValue("granted");
    render(<ConsentBanner />);
    expect(
      screen.queryByRole("dialog", { name: /souhlas s analytikou/i }),
    ).not.toBeInTheDocument();
  });
});
