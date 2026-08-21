import { describe, expect, it } from "vitest";

import {
  makeAssignment,
  makeDraftEvent,
  makeMemberWithProfile,
  makeProfileSummary,
  makeResultFile,
  makeTeam,
} from "@/tests/component/birth-giving-fixtures";
import {
  buildBirthGivingRetrospectiveReview,
  collectBirthGivingAffectedProfiles,
} from "@/lib/birth-giving/retrospective";

describe("collectBirthGivingAffectedProfiles", () => {
  it("collects each participating profile once across teams and skips cancelled teams", () => {
    const event = makeDraftEvent({
      teams: [
        makeTeam({
          id: "team-1",
          status: "confirmed",
          members: [makeMemberWithProfile({ profile_id: "profile-a" })],
        }),
        makeTeam({
          id: "team-2",
          status: "confirmed",
          members: [
            makeMemberWithProfile({ profile_id: "profile-a" }),
            makeMemberWithProfile({ profile_id: "profile-b" }),
          ],
        }),
        makeTeam({
          id: "team-3",
          status: "cancelled",
          members: [makeMemberWithProfile({ profile_id: "profile-c" })],
        }),
      ],
    });

    const profiles = collectBirthGivingAffectedProfiles(event);

    expect(profiles.map((profile) => profile.id)).toEqual(["profile-a", "profile-b"]);
  });

  it("returns an empty list when no team has members", () => {
    const event = makeDraftEvent({
      teams: [makeTeam({ status: "confirmed", members: [] })],
    });

    expect(collectBirthGivingAffectedProfiles(event)).toEqual([]);
  });
});

describe("buildBirthGivingRetrospectiveReview", () => {
  it("flags missing assignment, missing teams, and per-team validation issues", () => {
    const event = makeDraftEvent({
      assignment: null,
      minimum_team_size: 2,
      maximum_team_size: 4,
      teams: [
        makeTeam({
          status: "confirmed",
          result_state: "present",
          result_files: [],
          members: [makeMemberWithProfile()],
        }),
        makeTeam({
          status: "confirmed",
          result_state: "pending",
          members: [],
        }),
      ],
    });

    const review = buildBirthGivingRetrospectiveReview(event);

    expect(review.assignmentPending).toBe(true);
    expect(review.affectedProfiles.map((profile) => profile.name)).toEqual(["Member One"]);

    const [first, second] = review.teamIssues;
    expect(first.memberCount).toBe(1);
    expect(first.sizeValid).toBe(false);
    expect(first.resultStatePending).toBe(false);
    expect(first.resultPresentWithoutFiles).toBe(true);
    expect(second.memberCount).toBe(0);
    expect(second.sizeValid).toBe(false);
    expect(second.resultStatePending).toBe(true);
  });

  it("reports a clean review for a complete draft", () => {
    const event = makeDraftEvent({
      assignment: makeAssignment({ state: "present" }),
      minimum_team_size: 2,
      maximum_team_size: 4,
      teams: [
        makeTeam({
          status: "confirmed",
          result_state: "present",
          result_files: [makeResultFile()],
          members: [
            makeMemberWithProfile({ profile_id: "profile-a" }),
            makeMemberWithProfile({ profile_id: "profile-b" }),
          ],
        }),
      ],
    });

    const review = buildBirthGivingRetrospectiveReview(event);

    expect(review.assignmentPending).toBe(false);
    expect(review.teamsMissing).toBe(false);
    expect(review.teamIssues).toHaveLength(1);
    expect(review.teamIssues[0]).toMatchObject({
      sizeValid: true,
      resultStatePending: false,
      resultPresentWithoutFiles: false,
    });
    expect(review.affectedProfiles.map((profile) => profile.id)).toEqual(["profile-a", "profile-b"]);
  });

  it("reports a draft without teams as blocked while it has no affected profiles", () => {
    const event = makeDraftEvent({ assignment: makeAssignment(), teams: [] });

    const review = buildBirthGivingRetrospectiveReview(event);

    expect(review.teamsMissing).toBe(true);
    expect(review.teamIssues).toEqual([]);
    expect(review.affectedProfiles).toEqual([]);
  });

  it("keeps returned profile objects stable for a profile in several teams", () => {
    const profile = makeProfileSummary("shared", "Shared Person");
    const event = makeDraftEvent({
      teams: [
        makeTeam({
          status: "confirmed",
          members: [{ ...makeMemberWithProfile({ profile_id: "shared" }), profile }],
        }),
        makeTeam({
          status: "confirmed",
          members: [{ ...makeMemberWithProfile({ profile_id: "shared" }), profile }],
        }),
      ],
    });

    expect(collectBirthGivingAffectedProfiles(event)).toEqual([profile]);
  });
});