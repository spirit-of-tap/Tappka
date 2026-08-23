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
const RACE_STATEMENT_TIMEOUT_MS = 3_000;

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
  acknowledgeMove = false,
): Promise<string> {
  const { rows } = await client.query<{ birth_giving_create_proposal: string }>(
    "select public.birth_giving_create_proposal($1, $2, $3, $4, $5)",
    [eventId, teamId, candidateProfileId, direction, acknowledgeMove],
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

async function waitForBlockedConnections(applicationNames: string[]): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { rows } = await getPool().query<{ blocked_count: number }>(
      `select count(*)::integer as blocked_count
         from pg_stat_activity
        where application_name = any($1::text[])
          and wait_event_type = 'Lock'`,
      [applicationNames],
    );
    if (rows[0].blocked_count === applicationNames.length) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_POLL_MS));
  }
  throw new Error(`Connections did not block: ${applicationNames.join(", ")}`);
}

describe("Birth Giving lifecycle RPCs", () => {
  it("denies direct RPC calls from a verified profile without beta access", async () => {
    await withRollback(async (client) => {
      const nonBeta = await insertVerifiedProfile(client, { name: "Non-beta", betaAccess: false });
      await asClaims(client, { sub: nonBeta.authUserId });

      await expect(
        client.query(
          `select public.birth_giving_create_draft(
             'Denied', 'Customer', $1, '8h', 1, 3, true, $2::uuid[]
           )`,
          [timestamp(DAY_MS), [nonBeta.profileId]],
        ),
      ).rejects.toThrow(/active.*verified.*profile/i);
    });
  });

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

  it("scopes conflict-search visibility to owners before publishing and everyone after", async () => {
    await withRollback(async (client) => {
      const { organizer, other } = await actors(client);
      const startsAt = timestamp(DAY_MS);
      const eventId = await createDraft(client, organizer, { startsAt, suffix: "Private Exact" });

      await asClaims(client, { sub: organizer.authUserId });
      const { rows: ownRows } = await client.query(
        `select * from public.birth_giving_find_event_conflict(
           'event private exact', 'customer', $1
         )`,
        [startsAt],
      );
      expect(ownRows).toEqual([{ id: eventId, status: "draft" }]);

      await asClaims(client, { sub: other.authUserId });
      const { rows: hiddenRows } = await client.query(
        "select id from public.birth_giving_events where id = $1",
        [eventId],
      );
      expect(hiddenRows).toEqual([]);

      const { rows: conflictRows } = await client.query(
        `select * from public.birth_giving_find_event_conflict(
           'event private exact', 'customer', $1
         )`,
        [startsAt],
      );
      expect(conflictRows).toEqual([{ id: null, status: null }]);

      await asClaims(client, { sub: organizer.authUserId });
      await publish(client, eventId);
      await asClaims(client, { sub: other.authUserId });
      const { rows: publishedRows } = await client.query(
        `select * from public.birth_giving_find_event_conflict(
           'event private exact', 'customer', $1
         )`,
        [startsAt],
      );
      expect(publishedRows).toEqual([{ id: eventId, status: "published" }]);

      const { rows: nearMatchRows } = await client.query(
        `select * from public.birth_giving_find_event_conflict(
           'event private exact', 'different customer', $1
         )`,
        [startsAt],
      );
      expect(nearMatchRows).toEqual([]);
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

  it("patches draft and published events under a row lock without stale whole-row writes", async () => {
    await withRollback(async (client) => {
      const { organizer, other } = await actors(client);
      const eventId = await createDraft(client, organizer, { startsAt: timestamp(DAY_MS) });

      await asClaims(client, { sub: other.authUserId });
      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_update_event(p_event_id => $1, p_name => 'Unauthorized')",
          [eventId],
        ),
        /organizer|authorized/i,
      );
      await asClaims(client, { sub: organizer.authUserId });
      await client.query(
        "select public.birth_giving_update_event(p_event_id => $1, p_name => 'Changed draft')",
        [eventId],
      );
      await publish(client, eventId);
      await client.query(
        "select public.birth_giving_update_event(p_event_id => $1, p_joining_open => false)",
        [eventId],
      );
      const { rows } = await client.query(
        "select name, customer, joining_open from public.birth_giving_events where id = $1",
        [eventId],
      );
      expect(rows[0]).toMatchObject({
        name: "Changed draft",
        customer: "Customer",
        joining_open: false,
      });

      await client.query("reset role");
      await client.query(
        "update public.birth_giving_events set starts_at = clock_timestamp() - interval '1 hour' where id = $1",
        [eventId],
      );
      await asClaims(client, { sub: organizer.authUserId });
      await client.query(
        "select public.birth_giving_update_event(p_event_id => $1, p_name => 'Still active')",
        [eventId],
      );
      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_update_event(p_event_id => $1, p_joining_open => true)",
          [eventId],
        ),
        /joining|start/i,
      );

      await client.query("reset role");
      await client.query(
        "update public.birth_giving_events set starts_at = clock_timestamp() - interval '9 hours' where id = $1",
        [eventId],
      );
      await asClaims(client, { sub: organizer.authUserId });
      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_update_event(p_event_id => $1, p_name => 'Too late')",
          [eventId],
        ),
        /ended|update/i,
      );
    });
  });

  it("rejects moving an unstarted published event into the past but allows historical draft edits", async () => {
    await withRollback(async (client) => {
      const { organizer } = await actors(client);
      const eventId = await createDraft(client, organizer, { startsAt: timestamp(DAY_MS) });
      await publish(client, eventId);

      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_update_event(p_event_id => $1, p_starts_at => $2)",
          [eventId, timestamp(-9 * 60 * 60 * 1_000)],
        ),
        /published|start|past|ended/i,
      );
      const { rows: unchangedRows } = await client.query(
        "select starts_at, joining_open from public.birth_giving_events where id = $1",
        [eventId],
      );
      expect(Date.parse(unchangedRows[0].starts_at)).toBeGreaterThan(Date.now());
      expect(unchangedRows[0].joining_open).toBe(true);

      const historicalDraftId = await createDraft(client, organizer, {
        startsAt: timestamp(-DAY_MS),
        joiningOpen: false,
        suffix: "Historical Editable",
      });
      const changedStartsAt = timestamp(-2 * DAY_MS);
      await client.query(
        "select public.birth_giving_update_event(p_event_id => $1, p_starts_at => $2)",
        [historicalDraftId, changedStartsAt],
      );
      const { rows: draftRows } = await client.query(
        "select starts_at from public.birth_giving_events where id = $1",
        [historicalDraftId],
      );
      expect(new Date(draftRows[0].starts_at).toISOString()).toBe(changedStartsAt);
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

  it("rejects retrospective publication when a missing team has an active result file", async () => {
    await withRollback(async (client) => {
      const { organizer, member } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(-2 * DAY_MS),
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
      const { rows } = await client.query<{ birth_giving_create_historical_team: string }>(
        "select public.birth_giving_create_historical_team($1, 'Missing result', $2::uuid[], 'missing')",
        [eventId, [member.profileId]],
      );
      await client.query("reset role");
      await client.query(
        `insert into public.birth_giving_team_result_files
           (event_id, team_id, storage_path, original_file_name, mime_type, file_size,
            uploaded_by_profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $3, 'unexpected.pdf', 'application/pdf', 12, $4, $4, $4)`,
        [eventId, rows[0].birth_giving_create_historical_team, `bg/${crypto.randomUUID()}.pdf`, organizer.profileId],
      );
      await asClaims(client, { sub: organizer.authUserId });

      await expectDatabaseError(client, () => publish(client, eventId), /result file/i);
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

  it("uses the post-lock boundary decision for retrospective publication validation", async () => {
    const setupClient = await getPool().connect();
    const blocker = await getPool().connect();
    const publicationClient = await getPool().connect();
    let eventId: string | undefined;
    const authUserIds: string[] = [];
    const profileIds: string[] = [];
    try {
      await setupClient.query("begin");
      const organizer = await insertVerifiedProfile(setupClient, { name: "Publication boundary organizer" });
      authUserIds.push(organizer.authUserId);
      profileIds.push(organizer.profileId);
      eventId = await createDraft(setupClient, organizer, {
        startsAt: timestamp(1_000),
        suffix: "publication-boundary",
      });
      await setupClient.query("reset role");
      await setupClient.query(
        `insert into public.birth_giving_assignments
           (event_id, state, created_by_profile_id, updated_by_profile_id)
         values ($1, 'missing', $2, $2)`,
        [eventId, organizer.profileId],
      );
      const { rows: teamRows } = await setupClient.query<{ id: string }>(
        `insert into public.birth_giving_teams
           (event_id, name, status, result_state, created_by_profile_id, updated_by_profile_id)
         values ($1, 'Boundary result', 'confirmed', 'present', $2, $2)
         returning id`,
        [eventId, organizer.profileId],
      );
      await setupClient.query(
        `insert into public.birth_giving_team_members
           (event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $3, $3, $3)`,
        [eventId, teamRows[0].id, organizer.profileId],
      );
      await setupClient.query("commit");

      await blocker.query("begin");
      await blocker.query("select 1 from public.birth_giving_events where id = $1 for update", [eventId]);
      await publicationClient.query("begin");
      await publicationClient.query("set application_name = 'birth-giving-boundary-publication'");
      await publicationClient.query(`set local statement_timeout = '${RACE_STATEMENT_TIMEOUT_MS}ms'`);
      await asClaims(publicationClient, { sub: organizer.authUserId });
      const publication = publicationClient.query("select public.birth_giving_publish_event($1)", [eventId]);
      publication.catch(() => undefined);
      await waitForBlockedConnections(["birth-giving-boundary-publication"]);
      await new Promise((resolve) => setTimeout(resolve, 1_100));
      await blocker.query("commit");

      await expect(publication).rejects.toThrow(/result file/i);
      await publicationClient.query("rollback");
      const event = await setupClient.query(
        "select status, joining_open, start_processed_at from public.birth_giving_events where id = $1",
        [eventId],
      );
      expect(event.rows[0]).toMatchObject({ status: "draft", joining_open: true, start_processed_at: null });
    } finally {
      await blocker.query("rollback").catch(() => undefined);
      await publicationClient.query("rollback").catch(() => undefined);
      if (eventId) await setupClient.query("delete from public.birth_giving_events where id = $1", [eventId]);
      if (profileIds.length > 0) await setupClient.query("delete from public.profiles where id = any($1::uuid[])", [profileIds]);
      if (authUserIds.length > 0) {
        await setupClient.query("delete from public.users where auth_user_id = any($1::uuid[])", [authUserIds]);
        await setupClient.query("delete from auth.users where id = any($1::uuid[])", [authUserIds]);
      }
      await setupClient.query("rollback").catch(() => undefined);
      setupClient.release();
      blocker.release();
      publicationClient.release();
    }
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

  it("rejects formation when a transaction waits on the event lock past starts_at", async () => {
    const setupClient = await getPool().connect();
    const blocker = await getPool().connect();
    const formationClient = await getPool().connect();
    let eventId: string | undefined;
    const authUserIds: string[] = [];
    const profileIds: string[] = [];
    try {
      await setupClient.query("begin");
      const organizer = await insertVerifiedProfile(setupClient, { name: "Boundary organizer" });
      const member = await insertVerifiedProfile(setupClient, { name: "Boundary member" });
      authUserIds.push(organizer.authUserId, member.authUserId);
      profileIds.push(organizer.profileId, member.profileId);
      eventId = await createDraft(setupClient, organizer, {
        startsAt: timestamp(1_000),
        suffix: "formation-boundary",
      });
      await publish(setupClient, eventId);
      await setupClient.query("commit");

      await blocker.query("begin");
      await blocker.query("select 1 from public.birth_giving_events where id = $1 for update", [eventId]);
      await formationClient.query("begin");
      await formationClient.query("set application_name = 'birth-giving-boundary-formation'");
      await formationClient.query(`set local statement_timeout = '${RACE_STATEMENT_TIMEOUT_MS}ms'`);
      await asClaims(formationClient, { sub: member.authUserId });
      const formation = formationClient.query(
        "select public.birth_giving_create_team($1, 'Too late')",
        [eventId],
      );
      formation.catch(() => undefined);
      await waitForBlockedConnections(["birth-giving-boundary-formation"]);
      await new Promise((resolve) => setTimeout(resolve, 1_100));
      await blocker.query("commit");

      await expect(formation).rejects.toThrow(/formation.*closed/i);
      await formationClient.query("rollback");
      const team = await setupClient.query(
        "select 1 from public.birth_giving_teams where event_id = $1 and name = 'Too late'",
        [eventId],
      );
      expect(team.rowCount).toBe(0);
    } finally {
      await blocker.query("rollback").catch(() => undefined);
      await formationClient.query("rollback").catch(() => undefined);
      if (eventId) await setupClient.query("delete from public.birth_giving_events where id = $1", [eventId]);
      if (profileIds.length > 0) await setupClient.query("delete from public.profiles where id = any($1::uuid[])", [profileIds]);
      if (authUserIds.length > 0) {
        await setupClient.query("delete from public.users where auth_user_id = any($1::uuid[])", [authUserIds]);
        await setupClient.query("delete from auth.users where id = any($1::uuid[])", [authUserIds]);
      }
      await setupClient.query("rollback").catch(() => undefined);
      setupClient.release();
      blocker.release();
      formationClient.release();
    }
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
      const resolved = await client.query<{ birth_giving_resolve_proposal: string }>(
        "select public.birth_giving_resolve_proposal($1, 'accept')",
        [memberProposal],
      );
      expect(resolved.rows[0].birth_giving_resolve_proposal).toBe(eventId);

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

      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_resolve_proposal($1, 'accept')",
          [crypto.randomUUID()],
        ),
        /proposal is missing or already resolved/i,
      );
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

  it("requires explicit acknowledgement before proposing a move from another team", async () => {
    await withRollback(async (client) => {
      const { organizer, member, candidate } = await actors(client);
      const eventId = await createDraft(client, organizer, { maximumTeamSize: 4 });
      await publish(client, eventId);
      const targetTeamId = await createTeam(client, eventId, "Target");
      await asClaims(client, { sub: member.authUserId });
      await createTeam(client, eventId, "Current member team");

      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_create_proposal($1, $2, $3, 'join_request', false)",
          [eventId, targetTeamId, member.profileId],
        ),
        /MOVE_REQUIRES_ACKNOWLEDGEMENT/,
      );
      await client.query(
        "select public.birth_giving_create_proposal($1, $2, $3, 'join_request', true)",
        [eventId, targetTeamId, member.profileId],
      );

      await asClaims(client, { sub: candidate.authUserId });
      const candidateTeamId = await createTeam(client, eventId, "Current candidate team");
      await asClaims(client, { sub: organizer.authUserId });
      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_create_proposal($1, $2, $3, 'invitation', false)",
          [eventId, targetTeamId, candidate.profileId],
        ),
        /MOVE_REQUIRES_ACKNOWLEDGEMENT/,
      );
      const { rows } = await client.query<{ birth_giving_create_proposal: string }>(
        "select public.birth_giving_create_proposal($1, $2, $3, 'invitation', true)",
        [eventId, targetTeamId, candidate.profileId],
      );
      const membership = await client.query(
        "select team_id from public.birth_giving_team_members where event_id = $1 and profile_id = $2",
        [eventId, candidate.profileId],
      );
      expect(rows[0].birth_giving_create_proposal).toBeTypeOf("string");
      expect(membership.rows[0].team_id).toBe(candidateTeamId);
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
      const acceptedId = await createProposal(client, eventId, targetTeamId, member.profileId, "invitation", true);
      const competingId = await createProposal(client, eventId, targetTeamId, member.profileId, "invitation", true);
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
        "select id, state, updated_by_profile_id from public.birth_giving_team_proposals where id = any($1::uuid[]) order by id",
        [[competingId, candidateRequest]],
      );
      expect(competingRows.map((row) => row.state).sort()).toEqual(["cancelled", "pending"]);
      expect(competingRows.find((row) => row.id === competingId)?.updated_by_profile_id).toBe(member.profileId);
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
      firstAcceptance.catch(() => undefined);
      secondAcceptance.catch(() => undefined);
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

  it("serializes proposal resolution with due-start processing without deadlock", async () => {
    const setupClient = await getPool().connect();
    const pauseClient = await getPool().connect();
    const startClient = await getPool().connect();
    const resolveClient = await getPool().connect();
    let eventId: string | undefined;
    const authUserIds: string[] = [];
    const profileIds: string[] = [];
    try {
      await setupClient.query("begin");
      const organizer = await insertVerifiedProfile(setupClient, { name: "Start race organizer" });
      const candidate = await insertVerifiedProfile(setupClient, { name: "Start race candidate" });
      authUserIds.push(organizer.authUserId, candidate.authUserId);
      profileIds.push(organizer.profileId, candidate.profileId);
      eventId = await createDraft(setupClient, organizer, { minimumTeamSize: 1, suffix: "resolve-start-race" });
      await publish(setupClient, eventId);
      const teamId = await createTeam(setupClient, eventId, "Start race team");
      const proposalId = await createProposal(setupClient, eventId, teamId, candidate.profileId, "invitation");
      await setupClient.query("reset role");
      await setupClient.query("update public.birth_giving_events set starts_at = clock_timestamp() - interval '1 minute' where id = $1", [eventId]);
      await setupClient.query("commit");

      await setupClient.query(
        `create function public.birth_giving_test_pause_due_start()
         returns trigger language plpgsql set search_path = '' as $$
         begin
           if current_setting('application_name') = 'birth-giving-due-start-race'
              and old.start_processed_at is null and new.start_processed_at is not null then
             perform pg_catalog.pg_advisory_xact_lock(80719001);
           end if;
           return new;
         end
         $$`,
      );
      await setupClient.query(
        `create trigger birth_giving_test_pause_due_start
         before update on public.birth_giving_events
         for each row execute function public.birth_giving_test_pause_due_start()`,
      );
      await pauseClient.query("begin");
      await pauseClient.query("select pg_advisory_xact_lock(80719001)");

      await startClient.query("begin");
      await startClient.query("set application_name = 'birth-giving-due-start-race'");
      await startClient.query(`set local statement_timeout = '${RACE_STATEMENT_TIMEOUT_MS}ms'`);
      await startClient.query("set local role service_role");
      const processStart = startClient.query("select public.birth_giving_process_due_starts(1)");
      processStart.catch(() => undefined);
      await waitForBlockedConnections(["birth-giving-due-start-race"]);

      await resolveClient.query("begin");
      await resolveClient.query("set application_name = 'birth-giving-proposal-resolution-race'");
      await resolveClient.query(`set local statement_timeout = '${RACE_STATEMENT_TIMEOUT_MS}ms'`);
      await asClaims(resolveClient, { sub: candidate.authUserId });
      const resolution = resolveClient.query(
        "select public.birth_giving_resolve_proposal($1, 'accept')",
        [proposalId],
      );
      resolution.catch(() => undefined);
      await waitForBlockedConnections([
        "birth-giving-due-start-race",
        "birth-giving-proposal-resolution-race",
      ]);
      await pauseClient.query("commit");

      await expect(processStart).resolves.toBeDefined();
      await startClient.query("commit");
      await expect(resolution).rejects.toThrow(/already resolved|formation.*closed/i);
      await resolveClient.query("rollback");

      const { rows: eventRows } = await setupClient.query(
        "select joining_open, start_processed_at from public.birth_giving_events where id = $1",
        [eventId],
      );
      expect(eventRows[0].joining_open).toBe(false);
      expect(eventRows[0].start_processed_at).not.toBeNull();
      const { rows: proposalRows } = await setupClient.query(
        "select state from public.birth_giving_team_proposals where id = $1",
        [proposalId],
      );
      expect(proposalRows[0].state).toBe("expired");
      const membership = await setupClient.query(
        "select 1 from public.birth_giving_team_members where event_id = $1 and profile_id = $2",
        [eventId, candidate.profileId],
      );
      expect(membership.rowCount).toBe(0);
    } finally {
      await pauseClient.query("rollback").catch(() => undefined);
      await startClient.query("rollback").catch(() => undefined);
      await resolveClient.query("rollback").catch(() => undefined);
      await setupClient.query("drop trigger if exists birth_giving_test_pause_due_start on public.birth_giving_events").catch(() => undefined);
      await setupClient.query("drop function if exists public.birth_giving_test_pause_due_start()").catch(() => undefined);
      if (eventId) await setupClient.query("delete from public.birth_giving_events where id = $1", [eventId]);
      if (profileIds.length > 0) await setupClient.query("delete from public.profiles where id = any($1::uuid[])", [profileIds]);
      if (authUserIds.length > 0) {
        await setupClient.query("delete from public.users where auth_user_id = any($1::uuid[])", [authUserIds]);
        await setupClient.query("delete from auth.users where id = any($1::uuid[])", [authUserIds]);
      }
      await setupClient.query("rollback").catch(() => undefined);
      setupClient.release();
      pauseClient.release();
      startClient.release();
      resolveClient.release();
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

  it("rejects a deactivated profile in historical team selection", async () => {
    await withRollback(async (client) => {
      const { organizer, member } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(-2 * DAY_MS),
        joiningOpen: false,
      });
      await revoke(client, member, organizer.profileId);
      await asClaims(client, { sub: organizer.authUserId });

      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_create_historical_team($1, 'History', $2::uuid[], 'missing')",
          [eventId, [member.profileId]],
        ),
        /distinct existing profiles/i,
      );
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
      await client.query("reset role");
      await client.query(
        `insert into public.birth_giving_team_result_files
           (event_id, team_id, storage_path, original_file_name, mime_type, file_size,
            uploaded_by_profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $3, 'capacity.pdf', 'application/pdf', 12, $4, $4, $4)`,
        [
          eventId,
          firstTeam.rows[0].birth_giving_create_historical_team,
          `bg/${crypto.randomUUID()}.pdf`,
          organizer.profileId,
        ],
      );
      await asClaims(client, { sub: organizer.authUserId });

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

  it("requires an active result file when a published correction marks a team present", async () => {
    await withRollback(async (client) => {
      const { organizer, member } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(-2 * DAY_MS),
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
      const { rows } = await client.query<{ birth_giving_create_historical_team: string }>(
        "select public.birth_giving_create_historical_team($1, 'Published correction', $2::uuid[], 'missing')",
        [eventId, [member.profileId]],
      );
      const teamId = rows[0].birth_giving_create_historical_team;
      await publish(client, eventId);

      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_correct_team($1, $2, 'Published correction', $3::uuid[], 'present')",
          [eventId, teamId, [member.profileId]],
        ),
        /result file/i,
      );

      await client.query("reset role");
      await client.query(
        `insert into public.birth_giving_team_result_files
           (event_id, team_id, storage_path, original_file_name, mime_type, file_size,
            uploaded_by_profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $3, 'result.pdf', 'application/pdf', 12, $4, $4, $4)`,
        [eventId, teamId, `bg/${crypto.randomUUID()}.pdf`, organizer.profileId],
      );
      await asClaims(client, { sub: organizer.authUserId });
      await client.query(
        "select public.birth_giving_correct_team($1, $2, 'Published correction', $3::uuid[], 'present')",
        [eventId, teamId, [member.profileId]],
      );
      const team = await client.query("select result_state from public.birth_giving_teams where id = $1", [teamId]);
      expect(team.rows[0].result_state).toBe("present");

      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_correct_team($1, $2, 'Published correction', $3::uuid[], 'missing')",
          [eventId, teamId, [member.profileId]],
        ),
        /result file/i,
      );
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

  it("allows reflections only after the event's derived duration has ended", async () => {
    await withRollback(async (client) => {
      const { organizer, member } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(-60 * 60 * 1_000),
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
      await client.query(
        "select public.birth_giving_create_historical_team($1, 'Active event', $2::uuid[], 'missing')",
        [eventId, [member.profileId]],
      );
      await publish(client, eventId);
      await asClaims(client, { sub: member.authUserId });
      await expectDatabaseError(
        client,
        () => client.query("select public.birth_giving_upsert_reflection($1, 'Too soon', 'Still active')", [eventId]),
        /participation|ended/i,
      );

      await client.query("reset role");
      await client.query(
        "update public.birth_giving_events set starts_at = clock_timestamp() - interval '9 hours' where id = $1",
        [eventId],
      );
      await asClaims(client, { sub: member.authUserId });
      await client.query(
        "select public.birth_giving_upsert_reflection($1, 'After end', 'Now ended')",
        [eventId],
      );
      const reflection = await client.query(
        "select contribution from public.birth_giving_reflections where event_id = $1 and profile_id = $2",
        [eventId, member.profileId],
      );
      expect(reflection.rows[0].contribution).toBe("After end");
    });
  });

  it("processes due starts without advertising a missing assignment", async () => {
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
        "update public.birth_giving_teams set updated_by_profile_id = $2 where id = $1",
        [teamRows[0].id, member.profileId],
      );
      await client.query(
        "update public.birth_giving_team_members set updated_by_profile_id = profile_id where event_id = $1",
        [eventId],
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
      expect(eventRows[0].start_emails_queued_at).toBeNull();
      const { rows: teams } = await client.query(
        "select status, updated_by_profile_id from public.birth_giving_teams where event_id = $1 order by name",
        [eventId],
      );
      expect(teams.map((row) => row.status)).toEqual(["cancelled", "confirmed"]);
      expect(teams.find((row) => row.status === "confirmed")?.updated_by_profile_id).toBe(member.profileId);
      const { rows: memberships } = await client.query(
        "select profile_id, frozen_at, updated_by_profile_id from public.birth_giving_team_members where event_id = $1 order by profile_id",
        [eventId],
      );
      expect(memberships.filter((row) => row.frozen_at !== null).map((row) => row.profile_id).sort()).toEqual(
        [organizer.profileId, member.profileId].sort(),
      );
      expect(memberships.every((row) => row.updated_by_profile_id === row.profile_id)).toBe(true);
      const proposal = await client.query(
        "select state, updated_by_profile_id from public.birth_giving_team_proposals where event_id = $1",
        [eventId],
      );
      expect(proposal.rows[0].state).toBe("expired");
      expect(proposal.rows[0].updated_by_profile_id).toBe(candidate.profileId);
      const search = await client.query("select 1 from public.birth_giving_looking_for_team where event_id = $1", [eventId]);
      expect(search.rowCount).toBe(0);
      const deliveries = await client.query(
        `select profile_id, created_by_profile_id, updated_by_profile_id
           from public.birth_giving_email_deliveries where event_id = $1 order by profile_id`,
        [eventId],
      );
      expect(deliveries.rows).toEqual([]);
    });
  });

  it("queues release deliveries at start when the assignment is present", async () => {
    await withRollback(async (client) => {
      const { organizer } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(DAY_MS),
        minimumTeamSize: 1,
        maximumTeamSize: 2,
      });
      await client.query("reset role");
      const team = await client.query<{ id: string }>(
        `insert into public.birth_giving_teams
           (event_id, name, created_by_profile_id, updated_by_profile_id)
         values ($1, 'Release team', $2, $2) returning id`,
        [eventId, organizer.profileId],
      );
      await client.query(
        `insert into public.birth_giving_team_members
           (event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $3, $3, $3)`,
        [eventId, team.rows[0].id, organizer.profileId],
      );
      await client.query(
        `insert into public.birth_giving_assignments
           (event_id, state, storage_path, original_file_name, mime_type, file_size,
            uploaded_by_profile_id, uploaded_at, created_by_profile_id, updated_by_profile_id)
         values ($1, 'present', $3, 'assignment.pdf', 'application/pdf', 1000,
                 $2, now(), $2, $2)`,
        [eventId, organizer.profileId, `birth-giving/assignments/${eventId}/assignment.pdf`],
      );
      await asClaims(client, { sub: organizer.authUserId });
      await publish(client, eventId);
      await client.query("reset role");
      await client.query("update public.birth_giving_events set starts_at = $2 where id = $1", [eventId, timestamp(-60_000)]);
      await client.query("set local role service_role");

      await client.query("select public.birth_giving_process_due_starts(1)");
      await client.query("reset role");
      const deliveries = await client.query(
        `select profile_id, message_type, replacement_id
           from public.birth_giving_email_deliveries
          where event_id = $1`,
        [eventId],
      );
      expect(deliveries.rows).toEqual([{
        profile_id: organizer.profileId,
        message_type: "assignment_release",
        replacement_id: null,
      }]);
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
      expect(rows.find((row) => row.proname === "birth_giving_prepare_email_delivery")?.authenticated).toBe(false);
      expect(rows.find((row) => row.proname === "birth_giving_reconcile_email_deliveries")?.authenticated).toBe(false);
      expect(rows.find((row) => row.proname === "birth_giving_claim_email_deliveries")?.authenticated).toBe(false);

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

      const { rows: cutoffRows } = await client.query<{ proname: string; definition: string }>(
        `select p.proname, pg_get_functiondef(p.oid) as definition
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = any($1::text[])`,
        [[
          "birth_giving_create_team",
          "birth_giving_set_looking_for_team",
          "birth_giving_create_proposal",
          "birth_giving_resolve_proposal_locked",
        ]],
      );
      expect(cutoffRows).toHaveLength(4);
      expect(cutoffRows.every((row) => row.definition.includes("clock_timestamp()"))).toBe(true);

      const { rows: publicationRows } = await client.query<{ definition: string }>(
        `select pg_get_functiondef(p.oid) as definition
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'birth_giving_publish_event'`,
      );
      expect(publicationRows[0].definition.match(/clock_timestamp\(\)/g)).toHaveLength(1);
    });
  });

  it("claims bounded deliveries with fencing, stale lease recovery, replacement identity, and exponential retry", async () => {
    await withRollback(async (client) => {
      const { organizer } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(DAY_MS),
        minimumTeamSize: 1,
        maximumTeamSize: 2,
      });
      await client.query("reset role");
      const team = await client.query<{ id: string }>(
        `insert into public.birth_giving_teams
           (event_id, name, created_by_profile_id, updated_by_profile_id)
         values ($1, 'Delivery team', $2, $2) returning id`,
        [eventId, organizer.profileId],
      );
      await client.query(
        `insert into public.birth_giving_team_members
           (event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $3, $3, $3)`,
        [eventId, team.rows[0].id, organizer.profileId],
      );
      const assignment = await client.query<{ replacement_id: string }>(
        `insert into public.birth_giving_assignments
           (event_id, state, created_by_profile_id, updated_by_profile_id)
         values ($1, 'missing', $2, $2) returning replacement_id`,
        [eventId, organizer.profileId],
      );
      await client.query(
        `insert into public.birth_giving_email_deliveries
           (event_id, profile_id, message_type, replacement_id, recipient_email,
            created_by_profile_id, updated_by_profile_id)
         values ($1, $2, 'assignment_release', null, 'release@example.com', $2, $2),
                ($1, $2, 'assignment_replacement', $3, 'replacement@example.com', $2, $2)`,
        [eventId, organizer.profileId, assignment.rows[0].replacement_id],
      );
      await client.query(
        `update public.birth_giving_email_deliveries
            set next_attempt_at = now() + interval '1 hour'
          where event_id = $1 and message_type = 'assignment_replacement'`,
        [eventId],
      );
      await client.query("set local role service_role");

      const first = await client.query<{
        delivery_id: string;
        processing_token: string;
        message_type: string;
        replacement_id: string | null;
        attempt_count: number;
      }>("select * from public.birth_giving_claim_email_deliveries(1)");
      expect(first.rows).toHaveLength(1);
      expect(first.rows[0].attempt_count).toBe(1);

      const fenced = await client.query<{ result: boolean }>(
        "select public.birth_giving_complete_email_delivery($1, gen_random_uuid(), 'wrong') as result",
        [first.rows[0].delivery_id],
      );
      expect(fenced.rows[0].result).toBe(false);
      const failed = await client.query<{ result: boolean }>(
        "select public.birth_giving_fail_email_delivery($1, $2, 'temporary') as result",
        [first.rows[0].delivery_id, first.rows[0].processing_token],
      );
      expect(failed.rows[0].result).toBe(true);
      const retry = await client.query<{ status: string; delay_seconds: number; first_attempt_at: string | null }>(
        `select status, extract(epoch from (next_attempt_at - updated_at))::int as delay_seconds,
                first_attempt_at
           from public.birth_giving_email_deliveries where id = $1`,
        [first.rows[0].delivery_id],
      );
      expect(retry.rows[0].status).toBe("failed");
      expect(retry.rows[0].delay_seconds).toBe(60);
      expect(retry.rows[0].first_attempt_at).not.toBeNull();

      await client.query(
        `update public.birth_giving_email_deliveries
            set first_attempt_at = now() - interval '23 hours 1 minute',
                next_attempt_at = now() - interval '1 minute'
          where id = $1`,
        [first.rows[0].delivery_id],
      );
      const failedExpired = await client.query<{ result: number }>(
        "select public.birth_giving_reconcile_email_deliveries() as result",
      );
      expect(failedExpired.rows[0].result).toBe(1);
      const failedManualReview = await client.query<{ status: string }>(
        "select status from public.birth_giving_email_deliveries where id = $1",
        [first.rows[0].delivery_id],
      );
      expect(failedManualReview.rows[0].status).toBe("manual_review");

      await client.query(
        `update public.birth_giving_email_deliveries
            set status = 'processing', processing_started_at = now() - interval '11 minutes',
                first_attempt_at = now() - interval '22 hours', processing_token = gen_random_uuid()
          where message_type = 'assignment_replacement' and event_id = $1`,
        [eventId],
      );
      const stale = await client.query<{
        delivery_id: string;
        processing_token: string;
        message_type: string;
        replacement_id: string | null;
        attempt_count: number;
      }>("select * from public.birth_giving_claim_email_deliveries(1)");
      expect(stale.rows[0].message_type).toBe("assignment_replacement");
      expect(stale.rows[0].replacement_id).toBe(assignment.rows[0].replacement_id);
      expect(stale.rows[0].attempt_count).toBe(1);

      await client.query(
        `update public.birth_giving_email_deliveries
            set processing_started_at = now() - interval '11 minutes',
                first_attempt_at = now() - interval '23 hours 1 minute'
          where id = $1`,
        [stale.rows[0].delivery_id],
      );
      const reconciled = await client.query<{ result: number }>(
        "select public.birth_giving_reconcile_email_deliveries() as result",
      );
      expect(reconciled.rows[0].result).toBe(1);
      const expired = await client.query("select * from public.birth_giving_claim_email_deliveries(1)");
      expect(expired.rows).toEqual([]);
      const reconciliation = await client.query<{ status: string; last_error: string }>(
        "select status, last_error from public.birth_giving_email_deliveries where id = $1",
        [stale.rows[0].delivery_id],
      );
      expect(reconciliation.rows[0].status).toBe("manual_review");
      expect(reconciliation.rows[0].last_error).toMatch(/idempotency|manual/i);
    });
  });

  it("immutably snapshots an email payload under the matching processing fence", async () => {
    await withRollback(async (client) => {
      const { organizer } = await actors(client);
      const eventId = await createDraft(client, organizer, {
        startsAt: timestamp(DAY_MS),
        minimumTeamSize: 1,
        maximumTeamSize: 2,
      });
      await client.query("reset role");
      const team = await client.query<{ id: string }>(
        `insert into public.birth_giving_teams
           (event_id, name, created_by_profile_id, updated_by_profile_id)
         values ($1, 'Snapshot team', $2, $2) returning id`,
        [eventId, organizer.profileId],
      );
      await client.query(
        `insert into public.birth_giving_team_members
           (event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $3, $3, $3)`,
        [eventId, team.rows[0].id, organizer.profileId],
      );
      const delivery = await client.query<{ id: string }>(
        `insert into public.birth_giving_email_deliveries
           (event_id, profile_id, message_type, recipient_email, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, 'assignment_release', 'snapshot@example.com', $2, $2) returning id`,
        [eventId, organizer.profileId],
      );
      await client.query("set local role service_role");
      const claimed = await client.query<{ processing_token: string }>(
        "select processing_token from public.birth_giving_claim_email_deliveries(1)",
      );
      const first = await client.query<{ email_subject: string; email_html: string }>(
        "select * from public.birth_giving_prepare_email_delivery($1, $2, 'Original subject', '<p>Original URL</p>')",
        [delivery.rows[0].id, claimed.rows[0].processing_token],
      );
      const second = await client.query<{ email_subject: string; email_html: string }>(
        "select * from public.birth_giving_prepare_email_delivery($1, $2, 'Changed subject', '<p>Changed URL</p>')",
        [delivery.rows[0].id, claimed.rows[0].processing_token],
      );

      expect(first.rows[0]).toEqual({ email_subject: "Original subject", email_html: "<p>Original URL</p>" });
      expect(second.rows[0]).toEqual(first.rows[0]);
      const staleFence = await client.query(
        "select * from public.birth_giving_prepare_email_delivery($1, gen_random_uuid(), 'X', 'Y')",
        [delivery.rows[0].id],
      );
      expect(staleFence.rows).toEqual([]);
    });
  });
});
