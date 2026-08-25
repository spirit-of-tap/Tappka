import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BirthGivingResultFileList } from "@/components/birth-giving/result-file-list";
import {
  makeEvent,
  makeMemberWithProfile,
  makeResultFile,
  makeTeam,
  NOW,
} from "@/tests/component/birth-giving-fixtures";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("BirthGivingResultFileList", () => {
  it("lists every result file with its size and a download link", () => {
    const team = makeTeam({
      result_files: [
        makeResultFile({ id: "file-1", original_file_name: "vysledky.pdf", file_size: 1_500_000 }),
        makeResultFile({ id: "file-2", original_file_name: "prezentace.pptx", file_size: 2_500_000 }),
      ],
    });
    const event = makeEvent({ teams: [team] });
    render(
      <BirthGivingResultFileList event={event} team={team} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("vysledky.pdf")).toBeInTheDocument();
    expect(screen.getByText("prezentace.pptx")).toBeInTheDocument();
    expect(screen.getByText("1.5 MB")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /vysledky\.pdf/ })).toHaveAttribute(
      "href",
      "/api/birth-giving/result-files/file-1/download",
    );
  });

  it("renders the no-files state with the shared Empty primitive", () => {
    const team = makeTeam({ result_files: [] });
    const event = makeEvent({ teams: [team] });
    render(
      <BirthGivingResultFileList event={event} team={team} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    const empty = screen.getByText("Zatím žádné soubory s výsledky.");
    expect(empty.closest('[data-slot="empty"]')).not.toBeNull();
  });

  it("offers upload and delete to a team member", () => {
    const team = makeTeam({
      members: [makeMemberWithProfile()],
      result_files: [makeResultFile()],
    });
    const event = makeEvent({ teams: [team] });
    render(
      <BirthGivingResultFileList event={event} team={team} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Vybrat soubory s výsledky" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Smazat soubor vysledky.pdf" }),
    ).toBeInTheDocument();
  });

  it("deletes a file after confirmation and asks the parent to refresh", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);
    const onEventChange = vi.fn();
    const team = makeTeam({
      members: [makeMemberWithProfile()],
      result_files: [makeResultFile()],
    });
    const event = makeEvent({ teams: [team] });
    render(
      <BirthGivingResultFileList
        event={event}
        team={team}
        profileId="member-1"
        now={NOW}
        onEventChange={onEventChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Smazat soubor vysledky.pdf" }));
    await user.click(await screen.findByRole("button", { name: "Potvrdit" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/result-files/file-1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await waitFor(() => expect(onEventChange).toHaveBeenCalledWith(null));
  });

  it("shows the missing badge when the result was not recovered", () => {
    const team = makeTeam({ result_state: "missing", result_files: [] });
    const event = makeEvent({ teams: [team] });
    render(
      <BirthGivingResultFileList event={event} team={team} profileId="member-1" now={NOW} onEventChange={vi.fn()} />,
    );

    expect(screen.getByText("Výsledek nedohledán")).toBeInTheDocument();
  });
});