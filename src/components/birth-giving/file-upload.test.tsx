import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BirthGivingFileUpload } from "@/components/birth-giving/file-upload";

class FakeXmlHttpRequest {
  static instances: FakeXmlHttpRequest[] = [];
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  status = 200;

  constructor() {
    FakeXmlHttpRequest.instances.push(this);
  }

  open() {}
  setRequestHeader() {}
  send() {}
}

const fetchMock = vi.fn();

beforeEach(() => {
  FakeXmlHttpRequest.instances = [];
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("XMLHttpRequest", FakeXmlHttpRequest);
  fetchMock.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe("BirthGivingFileUpload", () => {
  it("renders a drag and drop zone with an accessible multiple file input", () => {
    render(<BirthGivingFileUpload kind="results" eventId="event-1" teamId="team-1" onUploaded={vi.fn()} />);

    expect(screen.getByLabelText("Soubory s výsledky")).toHaveAttribute("multiple");
    expect(screen.getByText("Přetáhněte výsledky sem nebo klikněte pro výběr")).toBeInTheDocument();
  });

  it("reports upload progress and confirms every selected result file", async () => {
    const onUploaded = vi.fn();
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { url: "https://upload.test/one", key: "key-one" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: "result-1" } }) });
    render(<BirthGivingFileUpload kind="results" eventId="event-1" teamId="team-1" onUploaded={onUploaded} />);

    const input = screen.getByLabelText("Soubory s výsledky");
    fireEvent.change(input, { target: { files: [new File(["data"], "result.pdf", { type: "application/pdf" })] } });
    await userEvent.click(screen.getByRole("button", { name: "Nahrát soubory" }));

    await waitFor(() => expect(FakeXmlHttpRequest.instances).toHaveLength(1));
    act(() => FakeXmlHttpRequest.instances[0].upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 } as ProgressEvent));
    expect(await screen.findByText("50 %")).toBeInTheDocument();
    act(() => FakeXmlHttpRequest.instances[0].onload?.());

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/birth-giving/events/event-1/teams/team-1/results/confirm",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows a validation error without requesting a presign URL", async () => {
    render(<BirthGivingFileUpload kind="assignment" eventId="event-1" onUploaded={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Soubor se zadáním"), {
      target: { files: [new File(["bad"], "payload.exe", { type: "application/octet-stream" })] },
    });
    await userEvent.click(screen.getByRole("button", { name: "Nahrát soubor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Tento typ souboru není povolený");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the selected file and exposes an error when storage upload fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { url: "https://upload.test/one", key: "key-one" } }) });
    render(<BirthGivingFileUpload kind="assignment" eventId="event-1" onUploaded={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Soubor se zadáním"), {
      target: { files: [new File(["data"], "assignment.pdf", { type: "application/pdf" })] },
    });
    await userEvent.click(screen.getByRole("button", { name: "Nahrát soubor" }));
    await waitFor(() => expect(FakeXmlHttpRequest.instances).toHaveLength(1));
    act(() => FakeXmlHttpRequest.instances[0].onerror?.());

    expect(await screen.findByRole("alert")).toHaveTextContent("Soubor se nepodařilo nahrát");
    expect(screen.getByText("assignment.pdf")).toBeInTheDocument();
  });
});
