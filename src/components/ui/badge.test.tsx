import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Nová</Badge>);
    expect(screen.getByText("Nová")).toBeInTheDocument();
  });
});
