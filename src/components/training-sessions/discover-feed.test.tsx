import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TrainingSessionListItem } from "@/lib/training-sessions/types";

import { DiscoverFeed } from "./discover-feed";

vi.mock("./session-agenda", () => ({
  SessionAgenda: ({
    sessions,
    emptyTitle,
  }: {
    sessions: TrainingSessionListItem[];
    emptyTitle: string;
  }) =>
    sessions.length > 0 ? (
      <div>
        {sessions.map((session) => (
          <p key={session.id}>{session.topic}</p>
        ))}
      </div>
    ) : (
      <p>{emptyTitle}</p>
    ),
}));

let intersectionCallback: IntersectionObserverCallback | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function intersect() {
  act(() => {
    intersectionCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

function session(id: string, topic: string): TrainingSessionListItem {
  return {
    id,
    team_id: "t1",
    topic,
    description: null,
    starts_at: "2026-11-10T06:00:00.000Z",
    ends_at: "2026-11-10T08:00:00.000Z",
    room_id: null,
    location_note: null,
    guest_capacity: 3,
    cancelled_at: null,
    team: { id: "t1", name: "Tuuli", color: null, onboardingYear: 2 },
    room: null,
    facilitators: [],
    guests: [],
    preparation: null,
  };
}

function renderFeed(props: { nextOffset: number | null; sessions?: TrainingSessionListItem[] }) {
  return render(
    <DiscoverFeed
      initialSessions={props.sessions ?? [session("s1", "První")]}
      nextOffset={props.nextOffset}
      query={{ filter: "nadchazejici", year: null, q: "" }}
      viewer={{ profileId: "p1", teamId: "t1" }}
      commitments={[]}
      now="2026-11-05T08:00:00.000Z"
      emptyTitle="Žádné TS"
      emptyDescription="V tomto období nic není."
    />,
  );
}

describe("DiscoverFeed", () => {
  beforeEach(() => {
    intersectionCallback = null;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("appends the next batch when the sentinel scrolls into view", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: [session("s2", "Druhá")], nextOffset: null }),
    });

    renderFeed({ nextOffset: 15 });

    expect(screen.getByText("První")).toBeInTheDocument();

    intersect();

    await waitFor(() => expect(screen.getByText("Druhá")).toBeInTheDocument());
    expect(screen.getByText("První")).toBeInTheDocument();

    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.pathname).toBe("/api/training-sessions");
    expect(url.searchParams.get("offset")).toBe("15");
    expect(url.searchParams.get("filtr")).toBe("nadchazejici");
  });

  it("keeps the query in the next request", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: [], nextOffset: null }),
    });

    render(
      <DiscoverFeed
        initialSessions={[]}
        nextOffset={0}
        query={{ filter: "volna-mista", year: 2, q: "reflexe" }}
        viewer={{ profileId: "p1", teamId: "t1" }}
        commitments={[]}
        now="2026-11-05T08:00:00.000Z"
        emptyTitle="Žádné TS"
        emptyDescription="V tomto období nic není."
      />,
    );

    intersect();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.searchParams.get("filtr")).toBe("volna-mista");
    expect(url.searchParams.get("rocnik")).toBe("2");
    expect(url.searchParams.get("q")).toBe("reflexe");
  });

  it("reloads every loaded batch when the server refreshes", async () => {
    fetchMock.mockImplementation(async (input: string) => {
      const offset = Number(new URL(input, "http://localhost").searchParams.get("offset"));
      if (offset === 0) {
        return {
          ok: true,
          json: async () => ({
            sessions: [session("s1", "První aktualizovaná"), session("s3", "Třetí")],
            nextOffset: 30,
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ sessions: [session("s2", "Druhá")], nextOffset: 30 }),
      };
    });

    const { rerender } = renderFeed({ nextOffset: 15 });

    intersect();
    await waitFor(() => expect(screen.getByText("Druhá")).toBeInTheDocument());

    rerender(
      <DiscoverFeed
        initialSessions={[session("s1", "První")]}
        nextOffset={15}
        query={{ filter: "nadchazejici", year: null, q: "" }}
        viewer={{ profileId: "p1", teamId: "t1" }}
        commitments={[]}
        now="2026-11-05T09:00:00.000Z"
        emptyTitle="Žádné TS"
        emptyDescription="V tomto období nic není."
      />,
    );

    await waitFor(() => expect(screen.getByText("První aktualizovaná")).toBeInTheDocument());
    expect(screen.getByText("Druhá")).toBeInTheDocument();
    expect(screen.getByText("Třetí")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("renders nothing but the empty state once the feed is exhausted", () => {
    renderFeed({ nextOffset: null, sessions: [] });

    expect(screen.getByText("Žádné TS")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not show a visible loading row", () => {
    renderFeed({ nextOffset: 15 });

    expect(screen.queryByText("Načítám další TS…")).not.toBeInTheDocument();
  });
});
