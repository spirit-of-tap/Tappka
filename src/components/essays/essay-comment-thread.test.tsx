import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EssayCommentThread } from "@/components/essays/essay-comment-thread";
import type { EssayCommentWithAuthor } from "@/lib/essays/types";

const fetchSpy = vi.spyOn(globalThis, "fetch");

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

/** Opens the delete confirmation and confirms it. */
async function confirmDelete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Smazat" }));
  await user.click(await screen.findByRole("button", { name: "Smazat komentář" }));
}

beforeEach(() => {
  fetchSpy.mockReset();
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
    const removed = { ...ownComment, removed_at: "2026-08-02T09:00:00.000Z" };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: removed }), { status: 200 }),
    );
    const user = userEvent.setup();
    renderThread();

    await confirmDelete(user);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/essays/essay-1/comments");
    expect(init?.method).toBe("DELETE");
    expect(jsonBody(init)).toEqual({ comment_id: "c-1" });
    expect(await screen.findByText("Komentář byl smazán")).toBeInTheDocument();
    expect(screen.queryByText("První komentář")).not.toBeInTheDocument();
    expect(screen.getByText("Karel Novák")).toBeInTheDocument();
  });

  it("asks for confirmation in-app and keeps the comment when cancelled", async () => {
    const user = userEvent.setup();
    renderThread();

    await user.click(screen.getByRole("button", { name: "Smazat" }));
    expect(await screen.findByText("Smazat komentář?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Zrušit" }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText("První komentář")).toBeInTheDocument();
  });

  it("clears the reply banner when the active reply target is deleted", async () => {
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

    await confirmDelete(user);

    expect(await screen.findByText("Komentář byl smazán")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Přidat komentář...")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Odpovědět na Karel Novák..."),
    ).not.toBeInTheDocument();
  });

  it("disables Smazat while the delete request is in flight", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    fetchSpy.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const user = userEvent.setup();
    renderThread();

    await confirmDelete(user);

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

    // The comment being edited hides its own action row, so the only remaining
    // Odpovědět belongs to the other comment.
    await user.click(screen.getAllByRole("button", { name: "Odpovědět" })[0]);

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

  it("hides a comment's own actions while it is being edited", async () => {
    const user = userEvent.setup();
    renderThread();

    expect(screen.getAllByRole("button", { name: "Odpovědět" })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Upravit" }));

    expect(screen.getAllByRole("button", { name: "Odpovědět" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Upravit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Smazat" })).not.toBeInTheDocument();
  });

  it("shows a non-student role as muted metadata beside the date", () => {
    renderThread([
      { ...ownComment, author: { ...ownComment.author!, role: "admin" } },
    ]);
    expect(screen.getByText(/Admin · 1\. 8\. 2026/)).toBeInTheDocument();
  });

  it("omits the role for students", () => {
    renderThread([ownComment]);
    expect(screen.queryByText(/Student/)).not.toBeInTheDocument();
    expect(screen.getByText("1. 8. 2026")).toBeInTheDocument();
  });

  it("renders an empty state when there are no comments", () => {
    renderThread([]);
    expect(screen.getByText("Zatím tu nejsou žádné komentáře. Začni diskuzi.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Přidat komentář...")).toBeInTheDocument();
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

const reply: EssayCommentWithAuthor = {
  id: "r-1",
  essay_id: "essay-1",
  author_profile_id: "profile-2",
  parent_id: "c-1",
  body: "Odpověď na první",
  removed_at: null,
  created_at: "2026-08-01T12:00:00.000Z",
  updated_at: "2026-08-01T12:00:00.000Z",
  author: { id: "profile-2", name: "Jana Dvořáková", picture: null, role: "student" },
};

/** True when `later` appears after `earlier` in document order. */
function follows(earlier: Element, later: Element) {
  return Boolean(
    earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe("EssayCommentThread threading", () => {
  it("renders a reply after the comment it answers", () => {
    renderThread([ownComment, reply]);
    expect(
      follows(screen.getByText("První komentář"), screen.getByText("Odpověď na první")),
    ).toBe(true);
  });

  it("orders comments oldest first regardless of input order", () => {
    renderThread([otherComment, ownComment]);
    expect(
      follows(screen.getByText("První komentář"), screen.getByText("Druhý komentář")),
    ).toBe(true);
  });

  it("flattens a reply-to-a-reply and labels who it answers", () => {
    const deepReply: EssayCommentWithAuthor = {
      ...reply,
      id: "r-2",
      parent_id: "r-1",
      body: "Odpověď na odpověď",
      created_at: "2026-08-01T13:00:00.000Z",
      author: { id: "profile-3", name: "Petr Svoboda", picture: null, role: "student" },
    };
    renderThread([ownComment, reply, deepReply]);

    expect(screen.getByText("Odpověď na odpověď")).toBeInTheDocument();
    // Jana appears twice: once as the author of r-1, once as the attribution
    // label on the flattened r-2.
    expect(screen.getAllByText("Jana Dvořáková")).toHaveLength(2);
  });

  it("keeps replies visible when their parent was removed", () => {
    const removedParent = { ...ownComment, removed_at: "2026-08-02T09:00:00.000Z" };
    renderThread([removedParent, reply]);

    expect(screen.getByText("Komentář byl smazán")).toBeInTheDocument();
    expect(screen.getByText("Odpověď na první")).toBeInTheDocument();
  });

  it("promotes a reply to a root when its parent is not in the list", () => {
    renderThread([{ ...reply, parent_id: "missing-id" }]);
    expect(screen.getByText("Odpověď na první")).toBeInTheDocument();
  });

  it("moves the composer into the thread being replied to", async () => {
    const user = userEvent.setup();
    renderThread([ownComment, reply, otherComment]);

    await user.click(screen.getAllByRole("button", { name: "Odpovědět" })[0]);

    const composer = screen.getByPlaceholderText("Odpovědět na Karel Novák...");
    // Inline in the first thread: after that thread's existing reply, and
    // before the unrelated second root comment.
    expect(follows(screen.getByText("Odpověď na první"), composer)).toBe(true);
    expect(follows(composer, screen.getByText("Druhý komentář"))).toBe(true);
  });
});