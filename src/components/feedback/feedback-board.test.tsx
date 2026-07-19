import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedbackBoard } from "@/components/feedback/feedback-board";
import type { FeedbackWithAuthor } from "@/lib/feedback/types";

function note(id: string, overrides: Partial<FeedbackWithAuthor> = {}): FeedbackWithAuthor {
  return {
    id,
    author_profile_id: "p1",
    body: `note-${id}`,
    archived_at: null,
    admin_response: null,
    admin_response_by: null,
    admin_response_at: null,
    created_at: "2026-07-09T10:00:00.000Z",
    updated_at: "2026-07-09T10:00:00.000Z",
    author: { id: "p1", name: "Jan", picture: null, role: "student" },
    ...overrides,
  };
}

describe("FeedbackBoard", () => {
  it("renders active notes and the form", () => {
    render(<FeedbackBoard initialActive={[note("a")]} initialArchived={[]} isAdmin={false} />);
    expect(screen.getByText("note-a")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Odeslat/i })).toBeInTheDocument();
  });

  it("shows empty state when there are no active notes", () => {
    render(<FeedbackBoard initialActive={[]} initialArchived={[]} isAdmin={false} />);
    expect(screen.getByText(/Zatím tu není žádná zpětná vazba/i)).toBeInTheDocument();
  });
});
