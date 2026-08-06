import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EssayCommentThread } from "@/components/essays/essay-comment-thread";
import type { EssayCommentWithAuthor } from "@/lib/essays/types";

const fetchSpy = vi.spyOn(globalThis, "fetch");

let confirmSpy: ReturnType<typeof vi.spyOn> | undefined;

const ownComment: EssayCommentWithAuthor = {
  id: "c-1",
  essay_id: "essay-1",
  author_profile_id: "profile-1",
  parent_id: null,
  body: "První komentář",
  removed_at: null,
  created_at: "2026-08-01T10:00:00.000Z",
  updated_at: "2026-08-01T10:00:00.000Z",
  author: { id: "profile-1", name: "Karel Novák", picture: null, role: "student" },
};

const otherComment: EssayCommentWithAuthor = {
  id: "c-2",
  essay_id: "essay-1",
  author_profile_id: "profile-2",
  parent_id: null,
  body: "Druhý komentář",
  removed_at: null,
  created_at: "2026-08-01T11:00:00.000Z",
  updated_at: "2026-08-01T11:00:00.000Z",
  author: { id: "profile-2", name: "Jana Dvořáková", picture: null, role: "student" },
};

const deletedComment: EssayCommentWithAuthor = {
  ...otherComment,
  id: "c-3",
  body: "Smazaný komentář",
  removed_at: "2026-08-02T09:00:00.000Z",
};

function renderThread(comments: EssayCommentWithAuthor[] = [ownComment, otherComment]) {
  return render(
    <EssayCommentThread
      essayId="essay-1"
      initialComments={comments}
      currentProfileId="profile-1"
    />,
  );
}

const jsonBody = (init?: RequestInit): Record<string, unknown> =>
  JSON.parse(String(init?.body ?? "{}"));

beforeEach(() => {
  fetchSpy.mockReset();
  confirmSpy = undefined;
});

afterEach(() => {
  confirmSpy?.mockRestore();
});

describe("EssayCommentThread", () => {
  it("renders initial comments with author names", () => {
    renderThread();
    expect(screen.getByText("Karel Novák")).toBeInTheDocument();
    expect(screen.getByText("Jana Dvořáková")).toBeInTheDocument();
    expect(screen.getByText("První komentář")).toBeInTheDocument();
    expect(screen.getByText("Druhý komentář")).toBeInTheDocument();
  });

  it("shows Upravit and Smazat only for own comments but Odpovědět for all", () => {
    renderThread();
    expect(screen.getAllByRole("button", { name: "Odpovědět" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Upravit" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Smazat" })).toHaveLength(1);
  });

  it("switches the composer to reply placeholder when Odpovědět is clicked", async () => {
    const user = userEvent.setup();
    renderThread();
    expect(screen.getByPlaceholderText("Přidat komentář...")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Odpovědět" })[1]);

    expect(
      screen.getByPlaceholderText("Odpovědět na Jana Dvořáková..."),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Přidat komentář...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zrušit" })).toBeInTheDocument();
  });

  it("posts a reply with parent_id when in reply mode", async () => {
    const reply: EssayCommentWithAuthor = { ...otherComment, id: "c-3", body: "Nová odpověď" };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: reply }), { status: 201 }),
    );
    const user = userEvent.setup();
    renderThread();

    await user.click(screen.getAllByRole("button", { name: "Odpovědět" })[1]);
    await user.type(
      screen.getByPlaceholderText("Odpovědět na Jana Dvořáková..."),
      "Nová odpověď",
    );
    await user.click(screen.getByRole("button", { name: "Odeslat komentář" }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/essays/essay-1/comments");
    expect(init?.method).toBe("POST");
    expect(jsonBody(init)).toEqual(
      expect.objectContaining({ parent_id: "c-2", body: "Nová odpověď" }),
    );
    expect(await screen.findByText("Nová odpověď")).toBeInTheDocument();
  });

  it("edits an own comment via PATCH and updates the DOM", async () => {
    const updated = { ...ownComment, body: "Upravený komentář" };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: updated }), { status: 200 }),
    );
    const user = userEvent.setup();
    renderThread();

    await user.click(screen.getByRole("button", { name: "Upravit" }));
    const editBox = screen.getByDisplayValue("První komentář");
    await user.clear(editBox);
    await user.type(editBox, "Upravený komentář");
    await user.click(screen.getByRole("button", { name: "Uložit" }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/essays/essay-1/comments");
    expect(init?.method).toBe("PATCH");
    expect(jsonBody(init)).toEqual({ comment_id: "c-1", body: "Upravený komentář" });
    expect(await screen.findByText("Upravený komentář")).toBeInTheDocument();
  });

  it("soft-deletes an own comment via DELETE and shows the muted state", async () => {
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const removed = { ...ownComment, removed_at: "2026-08-02T09:00:00.000Z" };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: removed }), { status: 200 }),
    );
    const user = userEvent.setup();
    renderThread();

    await user.click(screen.getByRole("button", { name: "Smazat" }));

    expect(confirmSpy).toHaveBeenCalledWith("Opravdu smazat tento komentář?");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/essays/essay-1/comments");
    expect(init?.method).toBe("DELETE");
    expect(jsonBody(init)).toEqual({ comment_id: "c-1" });
    expect(await screen.findByText("Komentář byl smazán")).toBeInTheDocument();
    expect(screen.queryByText("První komentář")).not.toBeInTheDocument();
    expect(screen.getByText("Karel Novák")).toBeInTheDocument();
  });

  it("clears the reply banner when the active reply target is deleted", async () => {
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const removed = { ...ownComment, removed_at: "2026-08-02T09:00:00.000Z" };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: removed }), { status: 200 }),
    );
    const user = userEvent.setup();
    renderThread();

    await user.click(screen.getAllByRole("button", { name: "Odpovědět" })[0]);
    expect(
      screen.getByPlaceholderText("Odpovědět na Karel Novák..."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Smazat" }));

    expect(await screen.findByText("Komentář byl smazán")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Přidat komentář...")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Odpovědět na Karel Novák..."),
    ).not.toBeInTheDocument();
  });

  it("disables Smazat while the delete request is in flight", async () => {
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    let resolveFetch: ((value: Response) => void) | undefined;
    fetchSpy.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const user = userEvent.setup();
    renderThread();

    await user.click(screen.getByRole("button", { name: "Smazat" }));

    expect(screen.getByRole("button", { name: "Smazat" })).toBeDisabled();

    resolveFetch?.(
      new Response(
        JSON.stringify({
          data: { ...ownComment, removed_at: "2026-08-02T09:00:00.000Z" },
        }),
        { status: 200 },
      ),
    );
    expect(await screen.findByText("Komentář byl smazán")).toBeInTheDocument();
  });

  it("starting an edit cancels an active reply mode", async () => {
    const user = userEvent.setup();
    renderThread();

    await user.click(screen.getAllByRole("button", { name: "Odpovědět" })[1]);
    expect(
      screen.getByPlaceholderText("Odpovědět na Jana Dvořáková..."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Upravit" }));

    expect(screen.getByDisplayValue("První komentář")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Odpovědět na Jana Dvořáková..."),
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Přidat komentář...")).toBeInTheDocument();
  });

  it("starting a reply cancels an active edit mode", async () => {
    const user = userEvent.setup();
    renderThread();

    await user.click(screen.getByRole("button", { name: "Upravit" }));
    expect(screen.getByDisplayValue("První komentář")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Odpovědět" })[1]);

    expect(
      screen.getByPlaceholderText("Odpovědět na Jana Dvořáková..."),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue("První komentář")).not.toBeInTheDocument();
  });

  it("cancels editing and restores the original body without fetching", async () => {
    const user = userEvent.setup();
    renderThread();

    await user.click(screen.getByRole("button", { name: "Upravit" }));
    const editBox = screen.getByDisplayValue("První komentář");
    await user.clear(editBox);
    await user.type(editBox, "Neznámé");
    await user.click(screen.getByRole("button", { name: "Zrušit" }));

    expect(screen.getByText("První komentář")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders a removed comment muted without action buttons", () => {
    renderThread([deletedComment]);
    expect(screen.getByText("Komentář byl smazán")).toBeInTheDocument();
    expect(screen.getByText("Jana Dvořáková")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Odpovědět" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upravit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Smazat" })).not.toBeInTheDocument();
  });
});