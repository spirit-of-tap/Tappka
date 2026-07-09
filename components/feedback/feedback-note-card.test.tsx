import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedbackNoteCard } from "@/components/feedback/feedback-note-card";
import type { FeedbackWithAuthor } from "@/lib/feedback/types";

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockReset();
});

const base: FeedbackWithAuthor = {
  id: "f1",
  author_profile_id: "p1",
  body: "Přidejte tmavý režim",
  archived_at: null,
  admin_response: null,
  admin_response_by: null,
  admin_response_at: null,
  created_at: "2026-07-09T10:00:00.000Z",
  updated_at: "2026-07-09T10:00:00.000Z",
  author: { id: "p1", name: "Jan Novák", picture: null, role: "student" },
};

const noop = () => {};

describe("FeedbackNoteCard", () => {
  it("renders body and author with role badge", () => {
    render(<FeedbackNoteCard feedback={base} isAdmin={false} onChanged={noop} onDeleted={noop} />);
    expect(screen.getByText("Přidejte tmavý režim")).toBeInTheDocument();
    expect(screen.getByText("Jan Novák")).toBeInTheDocument();
    expect(screen.getByText("Student")).toBeInTheDocument();
  });

  it("renders admin response when present", () => {
    const withResponse = { ...base, admin_response: "Díky, pracujeme na tom!" };
    render(<FeedbackNoteCard feedback={withResponse} isAdmin={false} onChanged={noop} onDeleted={noop} />);
    expect(screen.getByText("Díky, pracujeme na tom!")).toBeInTheDocument();
  });

  it("hides admin actions for non-admins", () => {
    render(<FeedbackNoteCard feedback={base} isAdmin={false} onChanged={noop} onDeleted={noop} />);
    expect(screen.queryByRole("button", { name: /Archivovat/i })).not.toBeInTheDocument();
  });

  it("shows admin actions for admins", () => {
    render(<FeedbackNoteCard feedback={base} isAdmin={true} onChanged={noop} onDeleted={noop} />);
    expect(screen.getByRole("button", { name: /Archivovat/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Odpovědět/i })).toBeInTheDocument();
  });
});
