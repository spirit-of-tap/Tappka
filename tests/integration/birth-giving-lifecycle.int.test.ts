import type { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import { insertVerifiedProfile } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import { getPool } from "@/tests/setup/testdb";
import { withRollback } from "@/tests/setup/tx";

interface Actor {
  authUserId: string;
  profileId: string;
}

interface DraftOptions {
  startsAt?: string;
  minimumTeamSize?: number;
  maximumTeamSize?: number;
  joiningOpen?: boolean;
  organizers?: string[];
  suffix?: string;
}

const DAY_MS = 24 * 60 * 60 * 1_000;
const LOCK_WAIT_POLL_MS = 10;
const LOCK_WAIT_TIMEOUT_MS = 5_000;

function timestamp(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

async function actors(client: PoolClient): Promise<{ organizer: Actor; member: Actor; candidate: Actor; other: Actor }> {
  return {
    organizer: await insertVerifiedProfile(client, { name: "Organizer" }),
    member: await insertVerifiedProfile(client, { name: "Member" }),
    candidate: await insertVerifiedProfile(client, { name: "Candidate" }),
    other: await insertVerifiedProfile(client, { name: "Other" }),
  };
}

async function createDraft(client: PoolClient, organizer: Actor, options: DraftOptions = {}): Promise<string> {
  await asClaims(client, { sub: organizer.authUserId });
  const suffix = options.suffix ?? crypto.randomUUID();
  const { rows } = await client.query<{ birth_giving_create_draft: string }>(
    `select public.birth_giving_create_draft(
       $1, 'Customer', $2, '8h', $3, $4, $5, $6::uuid[]
     )`,
    [
      `Event ${suffix}`,
      options.startsAt ?? timestamp(DAY_MS),
      options.minimumTeamSize ?? 1,
      options.maximumTeamSize ?? 3,
      options.joiningOpen ?? true,
      options.organizers ?? [organizer.profileId],
    ],
  );
  return rows[0].birth_giving_create_draft;
}

async function publish(client: PoolClient, eventId: string): Promise<void> {
  await client.query("select public.birth_giving_publish_event($1)", [eventId]);
}

async function createTeam(client: PoolClient, eventId: string, name: string): Promise<string> {
  const { rows } = await client.query<{ birth_giving_create_team: string }>(
    "select public.birth_giving_create_team($1, $2)",
    [eventId, name],
  );
  return rows[0].birth_giving_create_team;
}

async function createProposal(
  client: PoolClient,
  eventId: string,
  teamId: string,
  candidateProfileId: string,
  direction: "join_request" | "invitation",
): Promise<string> {
  const { rows } = await client.query<{ birth_giving_create_proposal: string }>(
    "select public.birth_giving_create_proposal($1, $2, $3, $4)",
    [eventId, teamId, candidateProfileId, direction],
  );
  return rows[0].birth_giving_create_proposal;
}

async function revoke(client: PoolClient, actor: Actor, byProfileId: string): Promise<void> {
  await client.query("reset role");
  await client.query("alter table public.profiles disable trigger enforce_picture_only_update");
  await client.query(
    "update public.profiles set access_removed_at = now(), access_removed_by_profile_id = $2 where id = $1",
    [actor.profileId, byProfileId],
  );
  await client.query("alter table public.profiles enable trigger enforce_picture_only_update");
}

async function expectDatabaseError(
  client: PoolClient,
  operation: () => Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  await client.query("savepoint expected_database_error");
  try {
    await operation();
    throw new Error("Expected database error");
  } catch (error: unknown) {
    await client.query("rollback to savepoint expected_database_error");
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(pattern);
  } finally {
    await client.query("release savepoint expected_database_error");
  }
}

async function waitForBlockedRaceConnections(): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { rows } = await getPool().query<{ blocked_count: number }>(
      `select count(*)::integer as blocked_count
         from pg_stat_activity
        where application_name in ('birth-giving-capacity-race-1', 'birth-giving-capacity-race-2')
          and wait_event_type = 'Lock'`,
    );
    if (rows[0].blocked_count === 2) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_POLL_MS));
  }
  throw new Error("Capacity race connections did not both block on the event lock");
}

describe("Birth Giving lifecycle RPCs", () => {
  it("creates and updates a private draft with caller-derived audit identity and organizers", async () => {
    await withRollback(async (client) => {
      const { organizer, member, other } = await actors(client);
      const eventId = await createDraft(client, organizer, { organizers: [organizer.profileId, member.profileId] });

      const { rows: draftRows } = await client.query(
        "select status, created_by_profile_id from public.birth_giving_events where id = $1",
        [eventId],
      );
      expect(draftRows[0]).toMatchObject({ status: "draft", created_by_profile_id: organizer.profileId });

      await client.query(
        `select public.birth_giving_upsert_draft(
           $1, 'Changed name', 'Changed customer', $2, '24h', 2, 4, false, $3::uuid[]
         )`,
        [eventId, timestamp(2 * DAY_MS), [organizer.profileId, other.profileId]],
      );
      const { rows: organizerRows } = await client.query(
        "select profile_id from public.birth_giving_event_organizers where event_id = $1 order by profile_id",
        [eventId],
      );
      expect(organizerRows.map((row) => row.profile_id)).toEqual([organizer.profileId, other.profileId].sort());
    });
  });

  it("rejects draft updates by non-organizers and callers with revoked access", async () => {
    await withRollback(async (client) => {
      const { organizer, other } = await actors(client);
      const eventId = await createDraft(client, organizer);

      await asClaims(client, { sub: other.authUserId });
      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_upsert_draft($1, 'No', 'No', $2, '8h', 1, 3, true, $3::uuid[])",
          [eventId, timestamp(DAY_MS), [other.profileId]],
        ),
        /organizer|authorized/i,
      );

      await revoke(client, organizer, other.profileId);
      await asClaims(client, { sub: organizer.authUserId });
      await expect(
        client.query("select public.birth_giving_publish_event($1)", [eventId]),
      ).rejects.toThrow(/active.*profile|authorized/i);
    });
  });

  it("publishes a valid upcoming draft but validates retrospective assignment, teams, and results", async () => {
    await withRollback(async (client) => {
      const { organizer, member } = await actors(client);
      const upcomingId = await createDraft(client, organizer, { suffix: "upcoming" });
      await publish(client, upcomingId);

      const historicalId = await createDraft(client, organizer, {
        startsAt: timestamp(-2 * DAY_MS),
        joiningOpen: false,
        suffix: "historical",
      });
      await expectDatabaseError(client, () => publish(client, historicalId), /assignment|team/i);

      await client.query("reset role");
      await client.query(
        `insert into public.birth_giving_assignments
           (event_id, state, created_by_profile_id, updated_by_profile_id)
         values ($1, 'missing', $2, $2)`,
        [historicalId, organizer.profileId],
      );
      await asClaims(client, { sub: organizer.authUserId });
      const { rows } = await client.query<{ birth_giving_create_historical_team: string }>(
        "select public.birth_giving_create_historical_team($1, 'Historical team', $2::uuid[], 'present')",
        [historicalId, [organizer.profileId, member.profileId]],
      );
      const historicalTeamId = rows[0].birth_giving_create_historical_team;
      expect(historicalTeamId).toBeTypeOf("string");
      await expectDatabaseError(client, () => publish(client, historicalId), /result file/i);
      await client.query(
        "select public.birth_giving_correct_team($1, $2, 'Historical team', $3::uuid[], 'missing')",
        [historicalId, historicalTeamId, [organizer.profileId, member.profileId]],
      );
      await publish(client, historicalId);

      const { rows: eventRows } = await client.query(
        "select status from public.birth_giving_events where id = any($1::uuid[]) order by id",
        [[upcomingId, historicalId]],
      );
      expect(eventRows.every((row) => row.status === "published")).toBe(true);
    });
  });

  it("finalizes historical participation at publication without queueing assignment release emails", async () => {
    await withRollback(async (client) => {
      const { organizer, member } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(-2 * DAY_MS),
        minimumTeamSize: 2,
        joiningOpen: true,
      });
      await client.query("reset role");
      await client.query(
        `insert into public.birth_giving_assignments
           (event_id, state, created_by_profile_id, updated_by_profile_id)
         values ($1, 'missing', $2, $2)`,
        [eventId, organizer.profileId],
      );
      await asClaims(client, { sub: organizer.authUserId });
      await client.query(
        "select public.birth_giving_create_historical_team($1, 'Historical', $2::uuid[], 'missing')",
        [eventId, [organizer.profileId, member.profileId]],
      );
      await publish(client, eventId);

      await client.query("reset role");
      await client.query("set local role service_role");
      const { rows: processedRows } = await client.query<{ birth_giving_process_due_starts: number }>(
        "select public.birth_giving_process_due_starts(10)",
      );
      await client.query("reset role");

      expect(processedRows[0].birth_giving_process_due_starts).toBe(0);
      const { rows: eventRows } = await client.query(
        `select joining_open, start_processed_at, start_emails_queued_at
           from public.birth_giving_events where id = $1`,
        [eventId],
      );
      expect(eventRows[0].joining_open).toBe(false);
      expect(eventRows[0].start_processed_at).not.toBeNull();
      expect(eventRows[0].start_emails_queued_at).toBeNull();
      const { rows: teams } = await client.query(
        "select status from public.birth_giving_teams where event_id = $1",
        [eventId],
      );
      expect(teams).toEqual([{ status: "confirmed" }]);
      const { rows: memberships } = await client.query(
        "select frozen_at from public.birth_giving_team_members where event_id = $1",
        [eventId],
      );
      expect(memberships).toHaveLength(2);
      expect(memberships.every((membership) => membership.frozen_at !== null)).toBe(true);
      const deliveries = await client.query(
        "select 1 from public.birth_giving_email_deliveries where event_id = $1",
        [eventId],
      );
      expect(deliveries.rowCount).toBe(0);
    });
  });

  it("creates a forming team with only the caller as member and clears their search", async () => {
    await withRollback(async (client) => {
      const { organizer, member } = await actors(client);
      const eventId = await createDraft(client, organizer);
      await publish(client, eventId);
      await asClaims(client, { sub: member.authUserId });
      await client.query("select public.birth_giving_set_looking_for_team($1, true)", [eventId]);
      const teamId = await createTeam(client, eventId, "New team");

      const { rows } = await client.query(
        `select m.profile_id, t.status
           from public.birth_giving_teams t
           join public.birth_giving_team_members m on m.team_id = t.id and m.event_id = t.event_id
          where t.id = $1`,
        [teamId],
      );
      expect(rows).toEqual([{ profile_id: member.profileId, status: "forming" }]);
      const search = await client.query(
        "select 1 from public.birth_giving_looking_for_team where event_id = $1 and profile_id = $2",
        [eventId, member.profileId],
      );
      expect(search.rowCount).toBe(0);
    });
  });

  it("restricts looking-for-team state to an active non-member in an open published event", async () => {
    await withRollback(async (client) => {
      const { organizer, member, other } = await actors(client);
      const eventId = await createDraft(client, organizer);
      await publish(client, eventId);
      await asClaims(client, { sub: member.authUserId });
      await client.query("select public.birth_giving_set_looking_for_team($1, true)", [eventId]);
      await client.query("select public.birth_giving_set_looking_for_team($1, false)", [eventId]);
      await revoke(client, member, other.profileId);
      await asClaims(client, { sub: member.authUserId });
      await expect(
        client.query("select public.birth_giving_set_looking_for_team($1, true)", [eventId]),
      ).rejects.toThrow(/active.*profile|authorized/i);
    });
  });

  it("allows candidates to request and any target-team member to approve", async () => {
    await withRollback(async (client) => {
      const { organizer, member, candidate } = await actors(client);
      const eventId = await createDraft(client, organizer);
      await publish(client, eventId);
      await asClaims(client, { sub: organizer.authUserId });
      const teamId = await createTeam(client, eventId, "Target");
      const memberProposal = await createProposal(client, eventId, teamId, member.profileId, "invitation");
      await asClaims(client, { sub: member.authUserId });
      await client.query("select public.birth_giving_resolve_proposal($1, 'accept')", [memberProposal]);

      await asClaims(client, { sub: candidate.authUserId });
      await client.query("select public.birth_giving_set_looking_for_team($1, true)", [eventId]);
      const requestId = await createProposal(client, eventId, teamId, candidate.profileId, "join_request");
      await asClaims(client, { sub: member.authUserId });
      await client.query("select public.birth_giving_resolve_proposal($1, 'accept')", [requestId]);

      const { rows } = await client.query(
        "select profile_id from public.birth_giving_team_members where event_id = $1 order by profile_id",
        [eventId],
      );
      expect(rows.map((row) => row.profile_id)).toEqual(
        [organizer.profileId, member.profileId, candidate.profileId].sort(),
      );
      const search = await client.query(
        "select 1 from public.birth_giving_looking_for_team where event_id = $1 and profile_id = $2",
        [eventId, candidate.profileId],
      );
      expect(search.rowCount).toBe(0);
    });
  });

  it("allows only the invitee to accept an invitation and supports reject and cancel authorization", async () => {
    await withRollback(async (client) => {
      const { organizer, candidate, other } = await actors(client);
      const eventId = await createDraft(client, organizer);
      await publish(client, eventId);
      const teamId = await createTeam(client, eventId, "Inviters");
      const invitationId = await createProposal(client, eventId, teamId, candidate.profileId, "invitation");

      await asClaims(client, { sub: other.authUserId });
      await expectDatabaseError(
        client,
        () => client.query("select public.birth_giving_resolve_proposal($1, 'accept')", [invitationId]),
        /invitee|authorized/i,
      );

      await asClaims(client, { sub: candidate.authUserId });
      await client.query("select public.birth_giving_resolve_proposal($1, 'reject')", [invitationId]);
      await asClaims(client, { sub: organizer.authUserId });
      const replacementId = await createProposal(client, eventId, teamId, candidate.profileId, "invitation");
      await client.query("select public.birth_giving_resolve_proposal($1, 'cancel')", [replacementId]);
      const { rows } = await client.query(
        "select state from public.birth_giving_team_proposals where id = any($1::uuid[]) order by created_at",
        [[invitationId, replacementId]],
      );
      expect(rows.map((row) => row.state)).toEqual(["rejected", "cancelled"]);
    });
  });

  it("atomically moves membership, clears search and competing proposals, and deletes an empty old team", async () => {
    await withRollback(async (client) => {
      const { organizer, member, candidate } = await actors(client);
      const eventId = await createDraft(client, organizer, { maximumTeamSize: 4 });
      await publish(client, eventId);
      const targetTeamId = await createTeam(client, eventId, "Target");
      await asClaims(client, { sub: member.authUserId });
      const oldTeamId = await createTeam(client, eventId, "Old");
      await asClaims(client, { sub: organizer.authUserId });
      const acceptedId = await createProposal(client, eventId, targetTeamId, member.profileId, "invitation");
      const competingId = await createProposal(client, eventId, targetTeamId, member.profileId, "invitation");
      await asClaims(client, { sub: candidate.authUserId });
      await client.query("select public.birth_giving_set_looking_for_team($1, true)", [eventId]);
      const candidateRequest = await createProposal(client, eventId, targetTeamId, candidate.profileId, "join_request");
      await asClaims(client, { sub: member.authUserId });
      await client.query("select public.birth_giving_resolve_proposal($1, 'accept')", [acceptedId]);

      const membership = await client.query(
        "select team_id from public.birth_giving_team_members where event_id = $1 and profile_id = $2",
        [eventId, member.profileId],
      );
      expect(membership.rows[0].team_id).toBe(targetTeamId);
      const oldTeam = await client.query("select 1 from public.birth_giving_teams where id = $1", [oldTeamId]);
      expect(oldTeam.rowCount).toBe(0);
      const { rows: competingRows } = await client.query(
        "select state from public.birth_giving_team_proposals where id = any($1::uuid[]) order by id",
        [[competingId, candidateRequest]],
      );
      expect(competingRows.map((row) => row.state).sort()).toEqual(["cancelled", "pending"]);
    });
  });

  it("rechecks capacity at acceptance and rejects cross-event team/proposal relationships", async () => {
    await withRollback(async (client) => {
      const { organizer, member, candidate, other } = await actors(client);
      const eventId = await createDraft(client, organizer, { maximumTeamSize: 2, suffix: "capacity" });
      await publish(client, eventId);
      const teamId = await createTeam(client, eventId, "Capacity");
      const first = await createProposal(client, eventId, teamId, member.profileId, "invitation");
      const second = await createProposal(client, eventId, teamId, candidate.profileId, "invitation");
      await asClaims(client, { sub: member.authUserId });
      await client.query("select public.birth_giving_resolve_proposal($1, 'accept')", [first]);
      await asClaims(client, { sub: candidate.authUserId });
      await expectDatabaseError(
        client,
        () => client.query("select public.birth_giving_resolve_proposal($1, 'accept')", [second]),
        /capacity|full/i,
      );

      await asClaims(client, { sub: organizer.authUserId });
      const otherEventId = await createDraft(client, organizer, { suffix: "cross-event" });
      await publish(client, otherEventId);
      await asClaims(client, { sub: other.authUserId });
      await expectDatabaseError(
        client,
        () => createProposal(client, otherEventId, teamId, other.profileId, "join_request"),
        /team|event/i,
      );
    });
  });

  it("accepts at most one proposal when two connections race for the final team place", async () => {
    const setupClient = await getPool().connect();
    const blocker = await getPool().connect();
    const firstClient = await getPool().connect();
    const secondClient = await getPool().connect();
    let eventId: string | undefined;
    const authUserIds: string[] = [];
    const profileIds: string[] = [];
    try {
      await setupClient.query("begin");
      const organizer = await insertVerifiedProfile(setupClient, { name: "Race organizer" });
      const firstCandidate = await insertVerifiedProfile(setupClient, { name: "Race candidate one" });
      const secondCandidate = await insertVerifiedProfile(setupClient, { name: "Race candidate two" });
      authUserIds.push(organizer.authUserId, firstCandidate.authUserId, secondCandidate.authUserId);
      profileIds.push(organizer.profileId, firstCandidate.profileId, secondCandidate.profileId);
      eventId = await createDraft(setupClient, organizer, { maximumTeamSize: 2, suffix: "concurrent-capacity" });
      await publish(setupClient, eventId);
      const teamId = await createTeam(setupClient, eventId, "One place left");
      const firstProposalId = await createProposal(
        setupClient,
        eventId,
        teamId,
        firstCandidate.profileId,
        "invitation",
      );
      const secondProposalId = await createProposal(
        setupClient,
        eventId,
        teamId,
        secondCandidate.profileId,
        "invitation",
      );
      await setupClient.query("commit");

      await blocker.query("begin");
      await blocker.query("select pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 0))", [eventId]);
      await firstClient.query("begin");
      await secondClient.query("begin");
      await firstClient.query("set application_name = 'birth-giving-capacity-race-1'");
      await secondClient.query("set application_name = 'birth-giving-capacity-race-2'");
      await asClaims(firstClient, { sub: firstCandidate.authUserId });
      await asClaims(secondClient, { sub: secondCandidate.authUserId });

      const acceptAndFinish = async (client: PoolClient, proposalId: string): Promise<void> => {
        try {
          await client.query("select public.birth_giving_resolve_proposal($1, 'accept')", [proposalId]);
          await client.query("commit");
        } catch (error: unknown) {
          await client.query("rollback");
          throw error;
        }
      };
      const firstAcceptance = acceptAndFinish(firstClient, firstProposalId);
      const secondAcceptance = acceptAndFinish(secondClient, secondProposalId);
      await waitForBlockedRaceConnections();
      await blocker.query("commit");
      const outcomes = await Promise.allSettled([firstAcceptance, secondAcceptance]);

      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
      const { rows } = await setupClient.query<{ member_count: number }>(
        "select count(*)::integer as member_count from public.birth_giving_team_members where team_id = $1",
        [teamId],
      );
      expect(rows[0].member_count).toBe(2);
    } finally {
      await blocker.query("rollback").catch(() => undefined);
      await firstClient.query("rollback").catch(() => undefined);
      await secondClient.query("rollback").catch(() => undefined);
      if (eventId) await setupClient.query("delete from public.birth_giving_events where id = $1", [eventId]);
      if (profileIds.length > 0) await setupClient.query("delete from public.profiles where id = any($1::uuid[])", [profileIds]);
      if (authUserIds.length > 0) {
        await setupClient.query("delete from public.users where auth_user_id = any($1::uuid[])", [authUserIds]);
        await setupClient.query("delete from auth.users where id = any($1::uuid[])", [authUserIds]);
      }
      await setupClient.query("rollback").catch(() => undefined);
      setupClient.release();
      blocker.release();
      firstClient.release();
      secondClient.release();
    }
  });

  it("lets historical organizers correct teams and membership without cross-event leakage", async () => {
    await withRollback(async (client) => {
      const { organizer, member, candidate, other } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(-2 * DAY_MS),
        minimumTeamSize: 2,
        joiningOpen: false,
      });
      const { rows } = await client.query<{ birth_giving_create_historical_team: string }>(
        "select public.birth_giving_create_historical_team($1, 'History', $2::uuid[], 'missing')",
        [eventId, [organizer.profileId, member.profileId]],
      );
      const teamId = rows[0].birth_giving_create_historical_team;
      await client.query(
        "select public.birth_giving_correct_team($1, $2, 'Corrected', $3::uuid[], 'present')",
        [eventId, teamId, [candidate.profileId, other.profileId]],
      );
      const { rows: memberRows } = await client.query(
        "select profile_id from public.birth_giving_team_members where event_id = $1 order by profile_id",
        [eventId],
      );
      expect(memberRows.map((row) => row.profile_id)).toEqual([candidate.profileId, other.profileId].sort());
    });
  });

  it("keeps organizer historical corrections within event capacity", async () => {
    await withRollback(async (client) => {
      const { organizer, member, candidate } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(-2 * DAY_MS),
        maximumTeamSize: 2,
        joiningOpen: false,
      });

      await expect(
        client.query(
          "select public.birth_giving_create_historical_team($1, 'Too large', $2::uuid[], 'missing')",
          [eventId, [organizer.profileId, member.profileId, candidate.profileId]],
        ),
      ).rejects.toThrow(/team size|capacity/i);
    });
  });

  it("rejects a processed historical correction that underfills another frozen team", async () => {
    await withRollback(async (client) => {
      const { organizer, member, candidate, other } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(-2 * DAY_MS),
        minimumTeamSize: 2,
        maximumTeamSize: 3,
        joiningOpen: false,
      });
      await client.query("reset role");
      await client.query(
        `insert into public.birth_giving_assignments
           (event_id, state, created_by_profile_id, updated_by_profile_id)
         values ($1, 'missing', $2, $2)`,
        [eventId, organizer.profileId],
      );
      await asClaims(client, { sub: organizer.authUserId });
      const firstTeam = await client.query<{ birth_giving_create_historical_team: string }>(
        "select public.birth_giving_create_historical_team($1, 'First', $2::uuid[], 'missing')",
        [eventId, [organizer.profileId, member.profileId]],
      );
      const secondTeam = await client.query<{ birth_giving_create_historical_team: string }>(
        "select public.birth_giving_create_historical_team($1, 'Second', $2::uuid[], 'missing')",
        [eventId, [candidate.profileId, other.profileId]],
      );
      await publish(client, eventId);

      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_correct_team($1, $2, 'First corrected', $3::uuid[], 'present')",
          [
            eventId,
            firstTeam.rows[0].birth_giving_create_historical_team,
            [organizer.profileId, member.profileId, candidate.profileId],
          ],
        ),
        /team size|capacity/i,
      );

      const { rows } = await client.query(
        `select team_id, profile_id, frozen_at
           from public.birth_giving_team_members
          where event_id = $1
          order by team_id, profile_id`,
        [eventId],
      );
      expect(rows).toHaveLength(4);
      expect(rows.filter((row) => row.team_id === secondTeam.rows[0].birth_giving_create_historical_team)).toHaveLength(2);
      expect(rows.every((row) => row.frozen_at !== null)).toBe(true);
    });
  });

  it("upserts only the caller's reflection for ended confirmed participation", async () => {
    await withRollback(async (client) => {
      const { organizer, member, other } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(-2 * DAY_MS),
        joiningOpen: false,
      });
      await client.query(
        "select public.birth_giving_create_historical_team($1, 'History', $2::uuid[], 'missing')",
        [eventId, [member.profileId]],
      );
      await client.query("reset role");
      await client.query(
        `insert into public.birth_giving_assignments
           (event_id, state, created_by_profile_id, updated_by_profile_id)
         values ($1, 'missing', $2, $2)`,
        [eventId, organizer.profileId],
      );
      await asClaims(client, { sub: organizer.authUserId });
      await publish(client, eventId);
      await asClaims(client, { sub: member.authUserId });
      await client.query("select public.birth_giving_upsert_reflection($1, 'Built it', 'Learned it')", [eventId]);
      await client.query("select public.birth_giving_upsert_reflection($1, 'Changed', 'More')", [eventId]);
      const { rows } = await client.query(
        "select profile_id, contribution, learning from public.birth_giving_reflections where event_id = $1",
        [eventId],
      );
      expect(rows).toEqual([{ profile_id: member.profileId, contribution: "Changed", learning: "More" }]);

      await asClaims(client, { sub: other.authUserId });
      await expect(
        client.query("select public.birth_giving_upsert_reflection($1, 'Spoof', 'No')", [eventId]),
      ).rejects.toThrow(/particip/i);
    });
  });

  it("processes due starts in a fixed idempotent sequence and deduplicates release deliveries", async () => {
    await withRollback(async (client) => {
      const { organizer, member, candidate } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(DAY_MS),
        minimumTeamSize: 2,
        maximumTeamSize: 3,
        joiningOpen: true,
      });
      await client.query("reset role");
      const { rows: teamRows } = await client.query<{ id: string }>(
        `insert into public.birth_giving_teams
           (event_id, name, created_by_profile_id, updated_by_profile_id)
         values ($1, 'Valid', $2, $2), ($1, 'Small', $2, $2)
         returning id`,
        [eventId, organizer.profileId],
      );
      await client.query(
        `insert into public.birth_giving_team_members
           (event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $4, $4, $4), ($1, $2, $5, $4, $4), ($1, $3, $6, $4, $4)`,
        [eventId, teamRows[0].id, teamRows[1].id, organizer.profileId, member.profileId, candidate.profileId],
      );
      await client.query(
        `insert into public.birth_giving_team_proposals
           (event_id, team_id, candidate_profile_id, initiated_by_profile_id, direction,
            created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $3, $3, 'join_request', $3, $3)`,
        [eventId, teamRows[0].id, candidate.profileId],
      );
      await client.query(
        `insert into public.birth_giving_looking_for_team
           (event_id, profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $2, $2)`,
        [eventId, candidate.profileId],
      );
      await client.query(
        `insert into public.birth_giving_assignments
           (event_id, state, created_by_profile_id, updated_by_profile_id)
         values ($1, 'missing', $2, $2)`,
        [eventId, organizer.profileId],
      );
      await asClaims(client, { sub: organizer.authUserId });
      await publish(client, eventId);

      await client.query("reset role");
      await client.query("update public.birth_giving_events set starts_at = $2 where id = $1", [eventId, timestamp(-60_000)]);
      await client.query("set local role service_role");
      await client.query("select public.birth_giving_process_due_starts(10)");
      await client.query("select public.birth_giving_process_due_starts(10)");
      await client.query("reset role");

      const { rows: eventRows } = await client.query(
        "select joining_open, start_processed_at, start_emails_queued_at from public.birth_giving_events where id = $1",
        [eventId],
      );
      expect(eventRows[0].joining_open).toBe(false);
      expect(eventRows[0].start_processed_at).not.toBeNull();
      expect(eventRows[0].start_emails_queued_at).not.toBeNull();
      const { rows: teams } = await client.query(
        "select status from public.birth_giving_teams where event_id = $1 order by name",
        [eventId],
      );
      expect(teams.map((row) => row.status)).toEqual(["cancelled", "confirmed"]);
      const { rows: memberships } = await client.query(
        "select profile_id, frozen_at from public.birth_giving_team_members where event_id = $1 order by profile_id",
        [eventId],
      );
      expect(memberships.filter((row) => row.frozen_at !== null).map((row) => row.profile_id).sort()).toEqual(
        [organizer.profileId, member.profileId].sort(),
      );
      const proposal = await client.query(
        "select state from public.birth_giving_team_proposals where event_id = $1",
        [eventId],
      );
      expect(proposal.rows[0].state).toBe("expired");
      const search = await client.query("select 1 from public.birth_giving_looking_for_team where event_id = $1", [eventId]);
      expect(search.rowCount).toBe(0);
      const deliveries = await client.query(
        "select profile_id from public.birth_giving_email_deliveries where event_id = $1 order by profile_id",
        [eventId],
      );
      expect(deliveries.rows.map((row) => row.profile_id)).toEqual([organizer.profileId, member.profileId].sort());
    });
  });

  it("exposes lifecycle functions only through narrow roles with pinned search paths", async () => {
    await withRollback(async (client) => {
      const { rows } = await client.query<{ proname: string; config: string[] | null; authenticated: boolean; anon: boolean }>(
        `select p.proname,
                p.proconfig as config,
                has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
                has_function_privilege('anon', p.oid, 'EXECUTE') as anon
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname like 'birth_giving_%'
          order by p.proname`,
      );
      expect(rows.length).toBeGreaterThanOrEqual(9);
      expect(rows.every((row) => row.config?.includes("search_path=\"\"") === true)).toBe(true);
      expect(rows.every((row) => row.anon === false)).toBe(true);
      expect(rows.find((row) => row.proname === "birth_giving_process_due_starts")?.authenticated).toBe(false);

      const { rows: triggerRows } = await client.query<{ table_name: string }>(
        `select c.relname as table_name
           from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and t.tgname like 'birth_giving_%_set_updated_at'
            and not t.tgisinternal
          order by c.relname`,
      );
      expect(triggerRows.map((row) => row.table_name)).toEqual([
        "birth_giving_assignments",
        "birth_giving_email_deliveries",
        "birth_giving_event_organizers",
        "birth_giving_events",
        "birth_giving_looking_for_team",
        "birth_giving_reflections",
        "birth_giving_team_members",
        "birth_giving_team_proposals",
        "birth_giving_team_result_files",
        "birth_giving_teams",
      ]);

      const { rows: resolverRows } = await client.query<{ definition: string }>(
        `select pg_get_functiondef(p.oid) as definition
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'birth_giving_resolve_proposal'`,
      );
      expect(resolverRows[0].definition).toContain("pg_advisory_xact_lock");
    });
  });
});
