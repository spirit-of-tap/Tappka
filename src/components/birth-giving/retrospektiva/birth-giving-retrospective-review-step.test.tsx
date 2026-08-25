import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { BirthGivingRetrospectiveReviewStep } from "@/components/birth-giving/retrospektiva/birth-giving-retrospective-review-step";
import {
  makeDraftEvent,
  makeMemberWithProfile,
  makeTeam,
} from "@/tests/component/birth-giving-fixtures";
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

const fetchSpy = vi.spyOn(globalThis, "fetch");

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
});

describe("BirthGivingRetrospectiveReviewStep", () => {
  it("lists participating profiles and readiness status", async () => {
    const event = makeDraftEvent({
      assignment_state: "present",
      teams: [
        makeTeam({
          id: "team-1",
          members: [makeMemberWithProfile()],
        }),
      ],
    });

    renderReview(event);

    expect(screen.getByText("Bez blokujících chyb")).toBeInTheDocument();
    expect(screen.getByText("Member One")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zveřejnit událost" })).toBeEnabled();
  });

  it("blocks publishing when there are no teams", () => {
    const event = makeDraftEvent({
      assignment_state: "present",
      teams: [],
    });

    renderReview(event);

    expect(screen.getByText("Zatím chybí alespoň jeden tým.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zveřejnit událost" })).toBeDisabled();
  });
});