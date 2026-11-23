import { describe, expect, it, vi, beforeAll } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyReservations } from "@/components/reservations/my-reservations";
import type { ReservationWithDetails } from "@/lib/reservations/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

beforeAll(() => {
  // `useIsMobile` (used by the responsive dialogs) needs matchMedia in jsdom.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

const RESERVATION_TITLE = "Retro týmu";
const ROW_LABEL = `Upravit rezervaci ${RESERVATION_TITLE}`;

const reservation: ReservationWithDetails = {
  id: "r1",
  room_id: "room-1",
  owner_profile_id: "p1",
  title: RESERVATION_TITLE,
  person_count: 3,
  start_at: "2099-07-09T10:00:00.000Z",
  end_at: "2099-07-09T11:00:00.000Z",
  cancelled_at: null,
  cancelled_by_profile_id: null,
  created_at: "2026-07-09T10:00:00.000Z",
  updated_at: "2026-07-09T10:00:00.000Z",
  created_by_profile_id: "p1",
  updated_by_profile_id: "p1",
  room: {
    id: "room-1",
    code: "d126",
    name: "D126",
    description: null,
    available_days: null,
    can_have_ts: true,
    removed_at: null,
    created_at: "2026-07-09T10:00:00.000Z",
    updated_at: "2026-07-09T10:00:00.000Z",
    created_by_profile_id: "p1",
    updated_by_profile_id: "p1",
  },
};

const renderList = () => render(<MyReservations reservations={[reservation]} />);

/** The edit dialog is the only thing rendering this heading. */
const editDialogHeading = () => screen.queryByRole("heading", { name: "Upravit rezervaci" });

describe("MyReservations row keyboard operability", () => {
  it("exposes the primary action as a native button without nesting interactive elements", () => {
    renderList();

    const primary = screen.getByRole("button", { name: ROW_LABEL });
    expect(primary.tagName).toBe("BUTTON");
    expect(primary.querySelector("button, a, [role='button']")).toBeNull();
    expect(screen.getByRole("button", { name: "Upravit" }).closest("button[aria-label^='Upravit rezervaci']")).toBeNull();
  });

  it("opens the edit dialog on Space", async () => {
    renderList();

    expect(editDialogHeading()).not.toBeInTheDocument();

    screen.getByRole("button", { name: ROW_LABEL }).focus();
    await userEvent.keyboard(" ");

    expect(editDialogHeading()).toBeInTheDocument();
  });

  it("opens the edit dialog on Enter", async () => {
    renderList();

    screen.getByRole("button", { name: ROW_LABEL }).focus();
    await userEvent.keyboard("{Enter}");

    expect(editDialogHeading()).toBeInTheDocument();
  });

  it("opens the edit dialog on click", async () => {
    renderList();

    await userEvent.click(screen.getByRole("button", { name: ROW_LABEL }));

    expect(editDialogHeading()).toBeInTheDocument();
  });

  it("does not open the edit dialog for keydown bubbling up from the row actions", () => {
    renderList();

    for (const key of ["Enter", " "]) {
      fireEvent.keyDown(screen.getByRole("button", { name: "Smazat" }), { key });
      expect(editDialogHeading()).not.toBeInTheDocument();

      fireEvent.keyDown(screen.getByRole("button", { name: "Upravit" }), { key });
      expect(editDialogHeading()).not.toBeInTheDocument();
    }
  });

  it("opens only the delete confirmation when Enter activates the nested Smazat button", async () => {
    renderList();

    const deleteButton = screen.getByRole("button", { name: "Smazat" });
    deleteButton.focus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Zrušit rezervaci?")).toBeInTheDocument();
    // The same Enter press must not have activated the row behind the buttons.
    expect(editDialogHeading()).not.toBeInTheDocument();
  });
});
