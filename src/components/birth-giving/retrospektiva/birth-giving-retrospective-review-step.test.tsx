import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { BirthGivingRetrospectiveReviewStep } from "@/components/birth-giving/retrospektiva/birth-giving-retrospective-review-step";
import {
  makeAssignment,
  makeDraftEvent,
  makeMemberWithProfile,
  makeResultFile,
  makeTeam,
} from "@/tests/component/birth-giving-fixtures";
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

const fetchSpy = vi.spyOn(globalThis, "fetch");

function json(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function renderReview(
  event: BirthGivingEventDetail,
  onPublish = vi.fn(),
  publishError: string | null = null,
) {
  return render(
    <BirthGivingRetrospectiveReviewStep
      event={event}
      busy={false}
      publishError={publishError}
      onPublish={onPublish}
    />,
  );
}

beforeEach(() => {
  fetchSpy.mockReset();
  fetchSpy.mockImplementation((input: RequestInfo | URL) => {
    if (String(input) === "/api/birth-giving/events/duplicate-candidates") {
      return Promise.resolve(json({ data: [] }));
    }
    return Promise.resolve(json({ data: null }));
  });
});

describe("BirthGivingRetrospectiveReviewStep", () => {
  it("lists blocking issues and the profiles whose BG count will increase", async () => {
    const event = makeDraftEvent({
      assignment: null,
      minimum_team_size: 2,
      maximum_team_size: 4,
      teams: [
        makeTeam({
          id: "team-1",
          status: "confirmed",
          result_state: "present",
          result_files: [],
          members: [makeMemberWithProfile()],
        }),
        makeTeam({
          id: "team-2",
          name: "Tým Beta",
          status: "confirmed",
          result_state: "pending",
          result_files: [],
          members: [],
        }),
      ],
    });

    renderReview(event);

    expect(
      await screen.findByText(
        "Zadání zatím nemá zadaný stav (nahrané nebo nedohledané).",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tým Alfa má 1 člena, což nesplňuje rozmezí 2–4.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Tým Alfa je přítomný, ale zatím nemá žádný soubor.")).toBeInTheDocument();
    expect(screen.getByText("Tým Beta nemá zadaný stav výsledku.")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Komu se zvýší počet BG" })).toBeInTheDocument();
    expect(screen.getByText("Member One")).toBeInTheDocument();

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/birth-giving/events/duplicate-candidates",
        expect.objectContaining({
          method: "POST",
        }),
      ),
    );
  });

  it("shows missing-document states and disabled-team issues", async () => {
    const event = makeDraftEvent({
      assignment: makeAssignment({ state: "missing" }),
      teams: [
        makeTeam({
          id: "team-1",
          name: "Tým Alfa",
          status: "confirmed",
          result_state: "missing",
          result_files: [],
          members: [makeMemberWithProfile()],
        }),
        makeTeam({
          id: "team-2",
          name: "Tým Beta",
          status: "confirmed",
          result_state: "present",
          result_files: [makeResultFile()],
          members: [makeMemberWithProfile()],
        }),
      ],
    });

    renderReview(event);

    expect(screen.getByText("Zadání nedohledáno")).toBeInTheDocument();
    expect(screen.getByText("Výsledek nedohledán")).toBeInTheDocument();
    expect(screen.queryByText("Zatím chybí alespoň jeden tým.")).not.toBeInTheDocument();
    const review = screen.getAllByText("Member One");
    expect(review.length).toBeGreaterThanOrEqual(1);
  });

  it("reports a draft without any team as blocked", async () => {
    const event = makeDraftEvent({ assignment: null, teams: [] });

    renderReview(event);

    expect(await screen.findByText("Zatím chybí alespoň jeden tým.")).toBeInTheDocument();
  });

  it("shows surfaced near-duplicate candidates on the review", async () => {
    const event = makeDraftEvent({ teams: [] });
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === "/api/birth-giving/events/duplicate-candidates") {
        return Promise.resolve(
          json({
            data: [
              {
                id: "existing-1",
                status: "published",
                name: "First BG",
                customer: "Zákazník A",
                starts_at: "2024-08-19T08:00:00.000Z",
              },
            ],
          }),
        );
      }
      return Promise.resolve(json({ data: null }));
    });

    renderReview(event);

    expect(await screen.findByText("Podobná událost už existuje")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /First BG/ })).toHaveAttribute(
      "href",
      "/birth-giving/existing-1",
    );
  });
});