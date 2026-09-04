import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import posthog from "posthog-js";

import { ConsentSettings } from "./consent-settings";

vi.mock("posthog-js", () => ({
  default: {
    get_explicit_consent_status: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}));

const mockedPosthog = vi.mocked(posthog);

describe("ConsentSettings", () => {
  it("withdraws consent with one click when granted", async () => {
    mockedPosthog.get_explicit_consent_status.mockReturnValue("granted");
    const user = userEvent.setup();
    render(<ConsentSettings />);
    await user.click(
      screen.getByRole("button", { name: /odvolat souhlas/i }),
    );
    expect(mockedPosthog.opt_out_capturing).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: /zapnout měření/i }),
    ).toBeInTheDocument();
  });

  it("re-grants consent with one click when denied", async () => {
    mockedPosthog.get_explicit_consent_status.mockReturnValue("denied");
    const user = userEvent.setup();
    render(<ConsentSettings />);
    await user.click(screen.getByRole("button", { name: /zapnout měření/i }));
    expect(mockedPosthog.opt_in_capturing).toHaveBeenCalledOnce();
  });
});
