import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  SpotlightProvider,
  SpotlightTrigger,
  useSpotlight,
} from "./index";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/",
}));

function ConsumerComponent() {
  const { isOpen } = useSpotlight();
  return <span data-testid="spotlight-state">{isOpen ? "open" : "closed"}</span>;
}

describe("Spotlight Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws error if useSpotlight is used outside SpotlightProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ConsumerComponent />)).toThrow(
      "useSpotlight must be used within a SpotlightProvider.",
    );
    spy.mockRestore();
  });

  it("opens and closes via hook methods", () => {
    const { result } = renderHook(() => useSpotlight(), {
      wrapper: ({ children }) => (
        <SpotlightProvider user={{ id: "user-1", beta_access: true }}>
          {children}
        </SpotlightProvider>
      ),
    });

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("opens dialog when SpotlightTrigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SpotlightProvider user={{ id: "user-1", beta_access: true }}>
        <SpotlightTrigger />
      </SpotlightProvider>,
    );

    const trigger = screen.getByRole("button", { name: /rychlé vyhledávání/i });
    expect(trigger).toBeInTheDocument();

    await user.click(trigger);

    expect(
      screen.getByPlaceholderText("Hledat v modulech a stránkách..."),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Rychlé vyhledávání v Tappce"),
    ).toBeInTheDocument();
  });

  it("toggles dialog on Cmd+K or Ctrl+K keydown", () => {
    render(
      <SpotlightProvider user={{ id: "user-1", beta_access: true }}>
        <ConsumerComponent />
      </SpotlightProvider>,
    );

    expect(screen.getByTestId("spotlight-state")).toHaveTextContent("closed");

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByTestId("spotlight-state")).toHaveTextContent("open");

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("spotlight-state")).toHaveTextContent("closed");
  });

  it("opens dialog on slash (/) key when not in an editable element", () => {
    render(
      <SpotlightProvider user={{ id: "user-1", beta_access: true }}>
        <ConsumerComponent />
        <input data-testid="test-input" />
      </SpotlightProvider>,
    );

    expect(screen.getByTestId("spotlight-state")).toHaveTextContent("closed");

    // Pressing / inside input should NOT open spotlight
    const input = screen.getByTestId("test-input");
    fireEvent.keyDown(input, { key: "/" });
    expect(screen.getByTestId("spotlight-state")).toHaveTextContent("closed");

    // Pressing / on window should open spotlight
    fireEvent.keyDown(window, { key: "/" });
    expect(screen.getByTestId("spotlight-state")).toHaveTextContent("open");
  });

  it("navigates to selected page and closes spotlight when typing query", async () => {
    const user = userEvent.setup();
    render(
      <SpotlightProvider user={{ id: "user-1", beta_access: true }}>
        <SpotlightTrigger />
      </SpotlightProvider>,
    );

    await user.click(screen.getByRole("button", { name: /rychlé vyhledávání/i }));

    const searchInput = screen.getByPlaceholderText("Hledat v modulech a stránkách...");
    expect(searchInput).toBeInTheDocument();

    await user.type(searchInput, "Dashboard");

    // Find and click Dashboard item
    const dashboardOption = screen.getByText("Dashboard");
    await user.click(dashboardOption);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("shows playful empty state with dog illustration and quote examples when search has no matches", async () => {
    const user = userEvent.setup();
    render(
      <SpotlightProvider user={{ id: "user-1", beta_access: true }}>
        <SpotlightTrigger />
      </SpotlightProvider>,
    );

    await user.click(screen.getByRole("button", { name: /rychlé vyhledávání/i }));

    const searchInput = screen.getByPlaceholderText("Hledat v modulech a stránkách...");
    await user.type(searchInput, "neexistujici_dotaz_12345");

    expect(
      screen.getByText("Haf! Tady jsme nic nenačichali..."),
    ).toBeInTheDocument();

    // Check sentence quote button is rendered
    const sentenceButton = screen.getByRole("button", { name: /chci napsat novou esej/i });
    expect(sentenceButton).toBeInTheDocument();

    // Clicking sentence quote populates search and brings up reading module
    await user.click(sentenceButton);

    await waitFor(() => {
      expect(screen.getByText("Čtení a knihovna")).toBeInTheDocument();
    });
  });
});
