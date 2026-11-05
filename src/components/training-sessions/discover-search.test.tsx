import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiscoverSearch } from "./discover-search";

const { replaceMock, paramsRef } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  paramsRef: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/ts/objevovat",
  useSearchParams: () => paramsRef.current,
}));

const SEARCH_LABEL = "Hledat TS";

function type(value: string) {
  fireEvent.change(screen.getByLabelText(SEARCH_LABEL), { target: { value } });
}

describe("DiscoverSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    replaceMock.mockClear();
    paramsRef.current = new URLSearchParams();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for the debounce before querying", () => {
    render(<DiscoverSearch />);

    type("přípr");
    type("příprava");
    act(() => vi.advanceTimersByTime(299));
    expect(replaceMock).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock.mock.calls[0][0]).toBe("/ts/objevovat?q=p%C5%99%C3%ADprava");
  });

  it("keeps filters in the URL", () => {
    paramsRef.current = new URLSearchParams("filtr=volna-mista&rocnik=2");
    render(<DiscoverSearch />);

    type("priprava");
    act(() => vi.advanceTimersByTime(300));

    const url = new URL(replaceMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.searchParams.get("q")).toBe("priprava");
    expect(url.searchParams.get("filtr")).toBe("volna-mista");
    expect(url.searchParams.get("rocnik")).toBe("2");
  });

  it("submits immediately on Enter", () => {
    render(<DiscoverSearch />);

    type("reflexe");
    fireEvent.keyDown(screen.getByLabelText(SEARCH_LABEL), { key: "Enter" });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock.mock.calls[0][0]).toContain("q=reflexe");
  });

  it("clears the query", () => {
    paramsRef.current = new URLSearchParams("q=reflexe");
    render(<DiscoverSearch />);

    fireEvent.click(screen.getByRole("button", { name: "Vymazat hledání" }));

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock.mock.calls[0][0]).toBe("/ts/objevovat");
  });
});
