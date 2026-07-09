import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EssayVoteButton } from "@/components/essays/essay-vote-button";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("EssayVoteButton", () => {
  const defaultProps = {
    essayId: "essay-1",
    initialVoteCount: 5,
    initialVoted: false,
  };

  it("renders the vote count", () => {
    render(<EssayVoteButton {...defaultProps} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows voted state when initialVoted is true", () => {
    render(<EssayVoteButton {...defaultProps} initialVoted={true} />);
    expect(screen.getByLabelText("Odebrat hlas")).toBeInTheDocument();
  });

  it("shows unvoted state when initialVoted is false (sm default)", () => {
    render(<EssayVoteButton {...defaultProps} />);
    expect(screen.getByLabelText("Hlasovat")).toBeInTheDocument();
  });

  it("renders readOnly mode without a button", () => {
    render(<EssayVoteButton {...defaultProps} readOnly={true} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders lg size with Líbí se mi to text", () => {
    render(<EssayVoteButton {...defaultProps} size="lg" />);
    expect(screen.getByText("Líbí se mi to")).toBeInTheDocument();
  });

  it("sends POST on click when not voted", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 201 }));
    const user = userEvent.setup();
    render(<EssayVoteButton {...defaultProps} />);
    await user.click(screen.getByLabelText("Hlasovat"));

    expect(fetchSpy).toHaveBeenCalledWith("/api/essays/essay-1/vote", {
      method: "POST",
    });
  });

  it("sends DELETE on click when already voted", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const user = userEvent.setup();
    render(<EssayVoteButton {...defaultProps} initialVoted={true} />);
    await user.click(screen.getByLabelText("Odebrat hlas"));

    expect(fetchSpy).toHaveBeenCalledWith("/api/essays/essay-1/vote", {
      method: "DELETE",
    });
  });

  it("does not call fetch when readOnly", async () => {
    const user = userEvent.setup();
    render(<EssayVoteButton {...defaultProps} readOnly={true} />);
    const countEl = screen.getByText("5");
    await user.click(countEl);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
