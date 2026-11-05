import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuickActions } from "./quick-actions";

describe("QuickActions", () => {
  it("links to the scrollky feed below the categories", () => {
    render(<QuickActions isCoach={false} />);

    expect(screen.getByRole("link", { name: /Scrollky/ })).toHaveAttribute(
      "href",
      "/cteni/hledat#scrollky",
    );
  });
});
