import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiscoverLoadMore } from "./discover-load-more";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

let intersectionCallback: IntersectionObserverCallback | null = null;

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

describe("DiscoverLoadMore", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    intersectionCallback = null;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the next horizon when the sentinel scrolls into view", () => {
    render(<DiscoverLoadMore nextHref="/ts/objevovat?mesicu=2" />);

    intersect();

    expect(replaceMock).toHaveBeenCalledWith("/ts/objevovat?mesicu=2", { scroll: false });
  });

  it("renders nothing once there is nothing more to load", () => {
    const { container } = render(<DiscoverLoadMore nextHref={null} />);

    intersect();

    expect(container).toBeEmptyDOMElement();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("does not fire the same page twice", () => {
    render(<DiscoverLoadMore nextHref="/ts/objevovat?mesicu=2" />);

    intersect();
    intersect();

    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  it("keeps loading when the current window has no results", async () => {
    render(<DiscoverLoadMore nextHref="/ts/objevovat?mesicu=2" autoLoad />);

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/ts/objevovat?mesicu=2", { scroll: false }),
    );
  });

  it("shows a loading hint while the next horizon renders", () => {
    render(<DiscoverLoadMore nextHref="/ts/objevovat?mesicu=2" />);

    intersect();

    expect(screen.getByText("Načítám další TS…")).toBeInTheDocument();
  });
});
