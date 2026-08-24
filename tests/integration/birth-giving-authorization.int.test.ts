import type { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import { insertAuthUser, insertVerifiedProfile } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

const FUTURE_OFFSET_MS = 30 * 24 * 60 * 60 * 1_000;

function futureTimestamp(): string {
  return new Date(Date.now() + FUTURE_OFFSET_MS).toISOString();
}

async function insertEvent(
  client: PoolClient,
  profileId: string,
  suffix: string,
  status = "draft",
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.birth_giving_events (
       name,
       customer,
       starts_at,
       duration,
       status,
       organizer_profile_ids,
       created_by_profile_id,
       updated_by_profile_id
     ) values ($1, 'Customer', $2, '8h', $3, $4::uuid[], $5, $5)
     returning id`,
    [`Event ${suffix}`, futureTimestamp(), status, [profileId], profileId],
  );
  return rows[0].id;
}

async function insertTeam(
  client: PoolClient,
  eventId: string,
  profileId: string,
  name: string,
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.birth_giving_teams (
       event_id,
       name,
       created_by_profile_id,
       updated_by_profile_id
     ) values ($1, $2, $3, $3)
     returning id`,
    [eventId, name, profileId],
  );
  return rows[0].id;
}

async function insertMember(
  client: PoolClient,
  eventId: string,
  teamId: string,
  profileId: string,
  actorProfileId: string,
): Promise<void> {
  await client.query(
    `insert into public.birth_giving_team_members (
       event_id,
       team_id,
       profile_id,
       created_by_profile_id,
       updated_by_profile_id
     ) values ($1, $2, $3, $4, $4)`,
    [eventId, teamId, profileId, actorProfileId],
  );
}

// A denied statement aborts the outer transaction, so wrap each expected RLS
// rejection in a savepoint to keep the transaction usable for later asserts.
async function expectRlsDenied(
  client: PoolClient,
  operation: () => Promise<unknown>,
): Promise<void> {
  await client.query("savepoint expected_rls_denial");
  try {
    await operation();
    throw new Error("Expected RLS denial but operation succeeded");
  } catch (error: unknown) {
    await client.query("rollback to savepoint expected_rls_denial");
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/row-level security/i);
  } finally {
    await client.query("release savepoint expected_rls_denial");
  }
}

function pastTimestamp(): string {
  return new Date(Date.now() - 60 * 60 * 1_000).toISOString();
}

type PgError = Error & { code?: string };

// A denied mutation aborts the outer transaction, so wrap each expected
// SQLSTATE error in a savepoint to keep the transaction usable for later
// assertions (mirrors expectRlsDenied above).
async function expectSqlState(
  client: PoolClient,
  code: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  await client.query("savepoint expected_sqlstate");
  try {
    await operation();
    throw new Error(`Expected SQLSTATE ${code} but operation succeeded`);
  } catch (error: unknown) {
    await client.query("rollback to savepoint expected_sqlstate");
    expect(error).toBeInstanceOf(Error);
    expect((error as PgError).code).toBe(code);
  } finally {
    await client.query("release savepoint expected_sqlstate");
  }
}

async function callSaveEvent(
  client: PoolClient,
  args: {
    eventId?: string | null;
    name: string;
    customer: string;
    startsAt: string;
    duration: string;
    organizerProfileIds: string[];
  },
): Promise<string> {
  const { rows } = await client.query<{ saved: string }>(
    `select public.birth_giving_save_event(
       $1, $2, $3, $4::timestamptz, $5::public.birth_giving_duration, $6::uuid[]
     ) as saved`,
    [
      args.eventId ?? null,
      args.name,
      args.customer,
      args.startsAt,
      args.duration,
      args.organizerProfileIds,
    ],
  );
  return rows[0].saved;
}

async function callPublishEvent(client: PoolClient, eventId: string): Promise<void> {
  await client.query("select public.birth_giving_publish_event($1)", [eventId]);
}

async function callRemoveEvent(client: PoolClient, eventId: string): Promise<void> {
  await client.query("select public.birth_giving_remove_event($1)", [eventId]);
}

describe("Birth Giving read-only authorization", () => {
  it("lets an active verified beta profile read published events, teams, and members", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const caller = await insertVerifiedProfile(client, { name: "Caller" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const eventId = await insertEvent(client, organizer.profileId, "published", "published");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Published team");
      await insertMember(client, eventId, teamId, member.profileId, organizer.profileId);

      await asClaims(client, { sub: caller.authUserId });

      const { rows: events } = await client.query<{ id: string }>(
        "select id from public.birth_giving_events",
      );
      expect(events).toEqual([{ id: eventId }]);

      const { rows: teams } = await client.query<{ id: string }>(
        "select id from public.birth_giving_teams",
      );
      expect(teams).toEqual([{ id: teamId }]);

      const { rows: memberships } = await client.query<{ profile_id: string }>(
        "select profile_id from public.birth_giving_team_members",
      );
      expect(memberships).toEqual([{ profile_id: member.profileId }]);
    });
  });

  it("shows draft events and their rows only to organizers", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const eventId = await insertEvent(client, organizer.profileId, "draft");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Draft team");

      await asClaims(client, { sub: organizer.authUserId });
      const organizerEvents = await client.query<{ id: string }>(
        "select id from public.birth_giving_events",
      );
      expect(organizerEvents.rows).toEqual([{ id: eventId }]);
      const organizerTeams = await client.query<{ id: string }>(
        "select id from public.birth_giving_teams",
      );
      expect(organizerTeams.rows).toEqual([{ id: teamId }]);

      await asClaims(client, { sub: outsider.authUserId });
      const outsiderEvents = await client.query<{ id: string }>(
        "select id from public.birth_giving_events",
      );
      expect(outsiderEvents.rows).toEqual([]);
      const outsiderTeams = await client.query<{ id: string }>(
        "select id from public.birth_giving_teams",
      );
      expect(outsiderTeams.rows).toEqual([]);
    });
  });

  it("denies direct inserts, updates, and deletes on all three tables", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const caller = await insertVerifiedProfile(client, { name: "Caller" });
      const eventId = await insertEvent(client, organizer.profileId, "write", "published");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Write team");

      await asClaims(client, { sub: caller.authUserId });

      await expectRlsDenied(client, () =>
        client.query(
          `insert into public.birth_giving_events (
             name, customer, starts_at, duration, status, organizer_profile_ids,
             created_by_profile_id, updated_by_profile_id
           ) values ('Nope', 'Customer', $1, '8h', 'draft', $2::uuid[], $3, $3)`,
          [futureTimestamp(), [caller.profileId], caller.profileId],
        ),
      );

      await expectRlsDenied(client, () =>
        client.query(
          `insert into public.birth_giving_teams (
             event_id, name, created_by_profile_id, updated_by_profile_id
           ) values ($1, 'Nope team', $2, $2)`,
          [eventId, caller.profileId],
        ),
      );

      await expectRlsDenied(
        client,
        () =>
          client.query(
            `insert into public.birth_giving_team_members (
               event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id
             ) values ($1, $2, $3, $3, $3)`,
            [eventId, teamId, caller.profileId],
          ),
      );

      const eventUpdate = await client.query(
        "update public.birth_giving_events set name = 'Hacked' where id = $1",
        [eventId],
      );
      expect(eventUpdate.rowCount).toBe(0);

      const teamUpdate = await client.query(
        "update public.birth_giving_teams set name = 'Hacked' where id = $1",
        [teamId],
      );
      expect(teamUpdate.rowCount).toBe(0);

      const memberUpdate = await client.query(
        "update public.birth_giving_team_members set confirmed_at = now() where team_id = $1",
        [teamId],
      );
      expect(memberUpdate.rowCount).toBe(0);

      const eventDelete = await client.query(
        "delete from public.birth_giving_events where id = $1",
        [eventId],
      );
      expect(eventDelete.rowCount).toBe(0);

      const teamDelete = await client.query(
        "delete from public.birth_giving_teams where id = $1",
        [teamId],
      );
      expect(teamDelete.rowCount).toBe(0);

      const memberDelete = await client.query(
        "delete from public.birth_giving_team_members where team_id = $1",
        [teamId],
      );
      expect(memberDelete.rowCount).toBe(0);

      // Even the event organizer cannot mutate rows directly: reads are the
      // only table-level access; mutations arrive through functions later.
      await asClaims(client, { sub: organizer.authUserId });
      const organizerUpdate = await client.query(
        "update public.birth_giving_events set name = 'Hacked' where id = $1",
        [eventId],
      );
      expect(organizerUpdate.rowCount).toBe(0);
      const organizerDelete = await client.query(
        "delete from public.birth_giving_teams where id = $1",
        [teamId],
      );
      expect(organizerDelete.rowCount).toBe(0);
    });
  });

  it("hides all rows from revoked, non-beta, and unverified callers", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "hidden", "published");
      await insertTeam(client, eventId, organizer.profileId, "Hidden team");

      // Revoked: verified beta profile whose access has been removed. The
      // profiles UPDATE trigger forbids clearing access_removed_at, so it is
      // seeded at INSERT time.
      const revokedAuth = await insertAuthUser(client);
      const { rows: revokedUserRows } = await client.query<{ id: string }>(
        "select id from public.users where auth_user_id = $1",
        [revokedAuth.id],
      );
      await client.query(
        "update public.users set verified_work_email = $2, verified_work_email_at = now() where auth_user_id = $1",
        [revokedAuth.id, `revoked-${revokedAuth.id}@studenti.czu.cz`],
      );
      await client.query(
        `insert into public.profiles (name, work_email, user_id, role, beta_access_granted_at, access_removed_at)
         values ('Revoked', $1, $2, 'student', now(), now())`,
        [`revoked-${revokedAuth.id}@studenti.czu.cz`, revokedUserRows[0].id],
      );

      const nonBeta = await insertVerifiedProfile(client, {
        name: "Non-beta",
        betaAccess: false,
      });

      const unverifiedAuth = await insertAuthUser(client);
      const { rows: unverifiedUserRows } = await client.query<{ id: string }>(
        "select id from public.users where auth_user_id = $1",
        [unverifiedAuth.id],
      );
      await client.query(
        `insert into public.profiles (name, work_email, user_id, role)
         values ('Unverified', $1, $2, 'student')`,
        [`unverified-${unverifiedAuth.id}@studenti.czu.cz`, unverifiedUserRows[0].id],
      );

      for (const authUserId of [revokedAuth.id, nonBeta.authUserId, unverifiedAuth.id]) {
        await asClaims(client, { sub: authUserId });
        const { rows: events } = await client.query(
          "select id from public.birth_giving_events",
        );
        expect(events).toEqual([]);
        const { rows: teams } = await client.query(
          "select id from public.birth_giving_teams",
        );
        expect(teams).toEqual([]);
        const { rows: memberships } = await client.query(
          "select id from public.birth_giving_team_members",
        );
        expect(memberships).toEqual([]);
      }
    });
  });
});

describe("Birth Giving event mutation functions", () => {
  it("denies every event mutation to inactive, revoked, non-beta, or unverified callers", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "mutations");

      // Revoked: verified beta profile whose access has already been removed.
      const revokedAuth = await insertAuthUser(client);
      const { rows: revokedUserRows } = await client.query<{ id: string }>(
        "select id from public.users where auth_user_id = $1",
        [revokedAuth.id],
      );
      await client.query(
        "update public.users set verified_work_email = $2, verified_work_email_at = now() where auth_user_id = $1",
        [revokedAuth.id, `revoked-${revokedAuth.id}@studenti.czu.cz`],
      );
      await client.query(
        `insert into public.profiles (name, work_email, user_id, role, beta_access_granted_at, access_removed_at)
         values ('Revoked', $1, $2, 'student', now(), now())`,
        [`revoked-${revokedAuth.id}@studenti.czu.cz`, revokedUserRows[0].id],
      );

      const nonBeta = await insertVerifiedProfile(client, {
        name: "Non-beta",
        betaAccess: false,
      });

      const unverifiedAuth = await insertAuthUser(client);
      const { rows: unverifiedUserRows } = await client.query<{ id: string }>(
        "select id from public.users where auth_user_id = $1",
        [unverifiedAuth.id],
      );
      await client.query(
        `insert into public.profiles (name, work_email, user_id, role)
         values ('Unverified', $1, $2, 'student')`,
        [`unverified-${unverifiedAuth.id}@studenti.czu.cz`, unverifiedUserRows[0].id],
      );

      for (const authUserId of [revokedAuth.id, nonBeta.authUserId, unverifiedAuth.id]) {
        await asClaims(client, { sub: authUserId });
        await expectSqlState(client, "42501", () =>
          callSaveEvent(client, {
            name: "Zakázané",
            customer: "Klient",
            startsAt: futureTimestamp(),
            duration: "8h",
            organizerProfileIds: [],
          }),
        );
        await expectSqlState(client, "42501", () => callPublishEvent(client, eventId));
        await expectSqlState(client, "42501", () => callRemoveEvent(client, eventId));
      }
    });
  });

  it("creates a draft whose organizer set contains the caller even when none is supplied", async () => {
    await withRollback(async (client) => {
      const caller = await insertVerifiedProfile(client, { name: "Caller" });
      await asClaims(client, { sub: caller.authUserId });

      const id = await callSaveEvent(client, {
        name: "Nový kurz",
        customer: "Klient",
        startsAt: futureTimestamp(),
        duration: "8h",
        organizerProfileIds: [],
      });

      const { rows } = await client.query<{
        organizer_profile_ids: string[];
        status: string;
        created_by_profile_id: string;
      }>(
        `select organizer_profile_ids, status, created_by_profile_id
           from public.birth_giving_events where id = $1`,
        [id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("draft");
      expect(rows[0].created_by_profile_id).toBe(caller.profileId);
      expect(rows[0].organizer_profile_ids).toEqual([caller.profileId]);
    });
  });

  it("requires the caller to be an organizer to update an event", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const eventId = await insertEvent(client, organizer.profileId, "upd");

      await asClaims(client, { sub: outsider.authUserId });
      await expectSqlState(client, "42501", () =>
        callSaveEvent(client, {
          eventId,
          name: "Změna",
          customer: "Klient",
          startsAt: futureTimestamp(),
          duration: "24h",
          organizerProfileIds: [outsider.profileId],
        }),
      );
    });
  });

  it("lets an organizer mutate editable fields, keeps status, and re-adds the caller as organizer", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const coOrganizer = await insertVerifiedProfile(client, { name: "Co-organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "upd2");

      await asClaims(client, { sub: organizer.authUserId });
      const newStartsAt = futureTimestamp();
      await callSaveEvent(client, {
        eventId,
        name: "Přejmenováno",
        customer: "Nový klient",
        startsAt: newStartsAt,
        duration: "24h",
        // Caller is intentionally omitted from the supplied set; the function
        // must append them so an organizer cannot lock themselves out.
        organizerProfileIds: [coOrganizer.profileId],
      });

      await client.query("reset role");
      const { rows } = await client.query<{
        name: string;
        customer: string;
        starts_at: Date;
        duration: string;
        status: string;
        created_by_profile_id: string;
        organizer_profile_ids: string[];
      }>(
        `select name, customer, starts_at, duration, status, created_by_profile_id, organizer_profile_ids
           from public.birth_giving_events where id = $1`,
        [eventId],
      );
      expect(rows[0].name).toBe("Přejmenováno");
      expect(rows[0].customer).toBe("Nový klient");
      expect(rows[0].starts_at.toISOString()).toBe(newStartsAt);
      expect(rows[0].duration).toBe("24h");
      // save_event exposes no status/assignment/removal arguments, so the
      // mutable surface stays limited to the organizer-editable fields.
      expect(rows[0].status).toBe("draft");
      expect(rows[0].created_by_profile_id).toBe(organizer.profileId);
      expect(rows[0].organizer_profile_ids).toContain(organizer.profileId);
      expect(rows[0].organizer_profile_ids).toContain(coOrganizer.profileId);
    });
  });

  it("rejects a normalized duplicate event identity with 23505", async () => {
    await withRollback(async (client) => {
      const caller = await insertVerifiedProfile(client, { name: "Caller" });
      await asClaims(client, { sub: caller.authUserId });

      const startsAt = futureTimestamp();
      await callSaveEvent(client, {
        name: "  Retrospektiva  Kurz  ",
        customer: "Duplikát",
        startsAt,
        duration: "8h",
        organizerProfileIds: [caller.profileId],
      });

      await expectSqlState(client, "23505", () =>
        callSaveEvent(client, {
          name: "retrospektiva kurz",
          customer: "Duplikát",
          startsAt,
          duration: "8h",
          organizerProfileIds: [caller.profileId],
        }),
      );
    });
  });

  it("rejects publishing a started retrospective draft whose assignment state is 'none'", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "past-none");
      await client.query(
        "update public.birth_giving_events set starts_at = $2 where id = $1",
        [eventId, pastTimestamp()],
      );

      await asClaims(client, { sub: organizer.authUserId });
      await expectSqlState(client, "23514", () => callPublishEvent(client, eventId));
    });
  });

  it("rejects publishing a started retrospective with no teams", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "past-noteam");
      await client.query(
        `update public.birth_giving_events
            set starts_at = $2, assignment_state = 'missing'
          where id = $1`,
        [eventId, pastTimestamp()],
      );

      await asClaims(client, { sub: organizer.authUserId });
      await expectSqlState(client, "23514", () => callPublishEvent(client, eventId));
    });
  });

  it("rejects publishing a started retrospective with a pending team result", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const eventId = await insertEvent(client, organizer.profileId, "past-pending");
      await client.query(
        `update public.birth_giving_events
            set starts_at = $2, assignment_state = 'missing'
          where id = $1`,
        [eventId, pastTimestamp()],
      );
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Tým");
      await insertMember(client, eventId, teamId, member.profileId, organizer.profileId);

      await asClaims(client, { sub: organizer.authUserId });
      await expectSqlState(client, "23514", () => callPublishEvent(client, eventId));
    });
  });

  it("publishes a complete started retrospective", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const eventId = await insertEvent(client, organizer.profileId, "past-ok");
      await client.query(
        `update public.birth_giving_events
            set starts_at = $2, assignment_state = 'missing'
          where id = $1`,
        [eventId, pastTimestamp()],
      );
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Tým");
      await insertMember(client, eventId, teamId, member.profileId, organizer.profileId);
      await client.query(
        "update public.birth_giving_teams set result_state = 'missing' where id = $1",
        [teamId],
      );

      await asClaims(client, { sub: organizer.authUserId });
      await callPublishEvent(client, eventId);

      const { rows } = await client.query<{
        status: string;
        updated_by_profile_id: string;
      }>("select status, updated_by_profile_id from public.birth_giving_events where id = $1", [
        eventId,
      ]);
      expect(rows[0].status).toBe("published");
      expect(rows[0].updated_by_profile_id).toBe(organizer.profileId);
    });
  });

  it("publishes a future draft without retrospective validation", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "future", "draft");

      await asClaims(client, { sub: organizer.authUserId });
      await callPublishEvent(client, eventId);

      const { rows } = await client.query<{ status: string }>(
        "select status from public.birth_giving_events where id = $1",
        [eventId],
      );
      expect(rows[0].status).toBe("published");
    });
  });

  it("removes an event only as an organizer and sets both removal columns", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const eventId = await insertEvent(client, organizer.profileId, "rm");

      // A non-organizer cannot remove the event.
      await asClaims(client, { sub: outsider.authUserId });
      await expectSqlState(client, "42501", () => callRemoveEvent(client, eventId));

      // The organizer can remove it.
      await asClaims(client, { sub: organizer.authUserId });
      await callRemoveEvent(client, eventId);

      // The removed event is hidden from RLS even for the organizer.
      const visible = await client.query<{ id: string }>(
        "select id from public.birth_giving_events where id = $1",
        [eventId],
      );
      expect(visible.rows).toEqual([]);

      // Inspect the removal columns directly as admin.
      await client.query("reset role");
      const { rows } = await client.query<{
        removed_at: string | null;
        removed_by_profile_id: string | null;
      }>(
        "select removed_at, removed_by_profile_id from public.birth_giving_events where id = $1",
        [eventId],
      );
      expect(rows[0].removed_at).not.toBeNull();
      expect(rows[0].removed_by_profile_id).toBe(organizer.profileId);
    });
  });

  it("keeps the private active-profile helper out of reach of authenticated callers", async () => {
    await withRollback(async (client) => {
      const caller = await insertVerifiedProfile(client, { name: "Caller" });
      await asClaims(client, { sub: caller.authUserId });

      // Grading EXECUTE: the private helper is not executable by authenticated.
      await expectSqlState(client, "42501", () =>
        client.query("select public.birth_giving_active_profile_id()"),
      );

      // The public event functions remain executable.
      const id = await callSaveEvent(client, {
        name: "Veřejné",
        customer: "Klient",
        startsAt: futureTimestamp(),
        duration: "8h",
        organizerProfileIds: [caller.profileId],
      });
      expect(id).toBeTruthy();
    });
  });
});

async function callCreateTeam(
  client: PoolClient,
  eventId: string,
  name: string,
  memberProfileIds: string[],
): Promise<string> {
  const { rows } = await client.query<{ created: string }>(
    `select public.birth_giving_create_team($1, $2, $3::uuid[]) as created`,
    [eventId, name, memberProfileIds],
  );
  return rows[0].created;
}

async function callUpdateTeam(
  client: PoolClient,
  args: {
    eventId: string;
    teamId: string;
    name?: string | null;
    memberProfileIds?: string[] | null;
    isWinner?: boolean | null;
  },
): Promise<void> {
  await client.query(
    `select public.birth_giving_update_team($1, $2, $3, $4::uuid[], $5)`,
    [
      args.eventId,
      args.teamId,
      args.name ?? null,
      args.memberProfileIds ?? null,
      args.isWinner ?? null,
    ],
  );
}

async function callDeleteTeam(
  client: PoolClient,
  eventId: string,
  teamId: string,
): Promise<void> {
  await client.query("select public.birth_giving_delete_team($1, $2)", [eventId, teamId]);
}

async function readTeamMembers(
  client: PoolClient,
  eventId: string,
  teamId: string,
): Promise<string[]> {
  const { rows } = await client.query<{ profile_id: string }>(
    `select profile_id
       from public.birth_giving_team_members
      where event_id = $1 and team_id = $2
      order by profile_id`,
    [eventId, teamId],
  );
  return rows.map((row) => row.profile_id);
}

async function seedInactiveCallerAuthIds(client: PoolClient): Promise<string[]> {
  // Returns the auth user ids of a revoked, a non-beta, and an unverified
  // caller, matching the inactive-caller seeds used elsewhere in this suite.
  const revokedAuth = await insertAuthUser(client);
  const { rows: revokedUserRows } = await client.query<{ id: string }>(
    "select id from public.users where auth_user_id = $1",
    [revokedAuth.id],
  );
  await client.query(
    "update public.users set verified_work_email = $2, verified_work_email_at = now() where auth_user_id = $1",
    [revokedAuth.id, `revoked-${revokedAuth.id}@studenti.czu.cz`],
  );
  await client.query(
    `insert into public.profiles (name, work_email, user_id, role, beta_access_granted_at, access_removed_at)
     values ('Revoked', $1, $2, 'student', now(), now())`,
    [`revoked-${revokedAuth.id}@studenti.czu.cz`, revokedUserRows[0].id],
  );

  const nonBeta = await insertVerifiedProfile(client, { name: "Non-beta", betaAccess: false });

  const unverifiedAuth = await insertAuthUser(client);
  const { rows: unverifiedUserRows } = await client.query<{ id: string }>(
    "select id from public.users where auth_user_id = $1",
    [unverifiedAuth.id],
  );
  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Unverified', $1, $2, 'student')`,
    [`unverified-${unverifiedAuth.id}@studenti.czu.cz`, unverifiedUserRows[0].id],
  );

  return [revokedAuth.id, nonBeta.authUserId, unverifiedAuth.id];
}

describe("Birth Giving team mutation functions", () => {
  it("denies every team mutation to inactive, revoked, non-beta, or unverified callers", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "team-inactive");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Tým");
      const inactiveAuthIds = await seedInactiveCallerAuthIds(client);

      for (const authUserId of inactiveAuthIds) {
        await asClaims(client, { sub: authUserId });
        await expectSqlState(client, "42501", () =>
          callCreateTeam(client, eventId, "Zakázáno", []),
        );
        await expectSqlState(client, "42501", () =>
          callUpdateTeam(client, { eventId, teamId, name: "Zakázáno" }),
        );
        await expectSqlState(client, "42501", () => callDeleteTeam(client, eventId, teamId));
        // Reset the in-transaction role so the next seeded assertion runs as admin
        // (the caller is replaced by asClaims on the next loop iteration anyway).
        await client.query("reset role");
      }
    });
  });

  it("denies every team mutation to an active caller who is not an organizer", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const eventId = await insertEvent(client, organizer.profileId, "team-outsider");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Tým");

      await asClaims(client, { sub: outsider.authUserId });
      await expectSqlState(client, "42501", () =>
        callCreateTeam(client, eventId, "Zakázáno", []),
      );
      await expectSqlState(client, "42501", () =>
        callUpdateTeam(client, { eventId, teamId, name: "Zakázáno" }),
      );
      await expectSqlState(client, "42501", () => callDeleteTeam(client, eventId, teamId));
    });
  });

  it("creates a team and its members atomically on a published event, always including the caller", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const eventId = await insertEvent(client, organizer.profileId, "pub-create", "published");

      await asClaims(client, { sub: organizer.authUserId });
      const teamId = await callCreateTeam(client, eventId, "Publikovaný tým", [member.profileId]);

      await client.query("reset role");
      const { rows: teamRows } = await client.query<{
        name: string;
        is_winner: boolean;
        result_state: string;
        result_files: unknown;
        created_by_profile_id: string;
        updated_by_profile_id: string;
      }>(
        `select name, is_winner, result_state, result_files, created_by_profile_id, updated_by_profile_id
           from public.birth_giving_teams where id = $1`,
        [teamId],
      );
      expect(teamRows).toHaveLength(1);
      expect(teamRows[0].name).toBe("Publikovaný tým");
      expect(teamRows[0].is_winner).toBe(false);
      expect(teamRows[0].result_state).toBe("pending");
      expect(teamRows[0].result_files).toEqual([]);
      expect(teamRows[0].created_by_profile_id).toBe(organizer.profileId);
      expect(teamRows[0].updated_by_profile_id).toBe(organizer.profileId);

      // The caller (organizer) is appended for a published event even though
      // only the supplied member was requested.
      const members = await readTeamMembers(client, eventId, teamId);
      expect(members).toEqual([member.profileId, organizer.profileId].sort());
    });
  });

  it("uses the exact supplied member set for a draft retrospective", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const memberA = await insertVerifiedProfile(client, { name: "Member A" });
      const memberB = await insertVerifiedProfile(client, { name: "Member B" });

      const eventCallerExcluded = await insertEvent(client, organizer.profileId, "draft-excl");
      const eventCallerIncluded = await insertEvent(client, organizer.profileId, "draft-incl");

      await asClaims(client, { sub: organizer.authUserId });
      const teamA = await callCreateTeam(client, eventCallerExcluded, "Biz bez organizátora", [
        memberA.profileId,
      ]);
      const teamB = await callCreateTeam(client, eventCallerIncluded, "S organizátorem", [
        organizer.profileId,
        memberB.profileId,
      ]);

      await client.query("reset role");
      expect(await readTeamMembers(client, eventCallerExcluded, teamA)).toEqual([
        memberA.profileId,
      ]);
      expect(await readTeamMembers(client, eventCallerIncluded, teamB)).toEqual(
        [organizer.profileId, memberB.profileId].sort(),
      );
    });
  });

  it("rejects a profile joining a second active team of the same event with 23505", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const eventId = await insertEvent(client, organizer.profileId, "dup");

      await asClaims(client, { sub: organizer.authUserId });
      await callCreateTeam(client, eventId, "Tým jedna", [member.profileId]);
      await expectSqlState(client, "23505", () =>
        callCreateTeam(client, eventId, "Tým dva", [member.profileId]),
      );
    });
  });

  it("rejects a nonexistent member profile with 23503 and an inactive one with 23514", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "badmember");
      const inactiveAuthIds = await seedInactiveCallerAuthIds(client);

      // Resolve the revoked profile id as admin (RLS would hide it from the
      // organizer); the function re-checks activeness itself under SECURITY
      // DEFINER privileges.
      const { rows: revokedProfileRows } = await client.query<{ id: string }>(
        `select p.id from public.profiles p
          join public.users u on u.id = p.user_id
         where u.auth_user_id = $1`,
        [inactiveAuthIds[0]],
      );

      await asClaims(client, { sub: organizer.authUserId });
      await expectSqlState(client, "23503", () =>
        callCreateTeam(client, eventId, "Neexistující", [
          "00000000-0000-0000-0000-000000000000",
        ]),
      );

      // The revoked profile exists but its access has been removed: an
      // inactive member is a different (23514) failure class.
      await expectSqlState(client, "23514", () =>
        callCreateTeam(client, eventId, "Neaktivní", [revokedProfileRows[0].id]),
      );
    });
  });

  it("updates name and synchronizes members atomically for an organizer", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const memberA = await insertVerifiedProfile(client, { name: "Member A" });
      const memberC = await insertVerifiedProfile(client, { name: "Member C" });
      const eventId = await insertEvent(client, organizer.profileId, "upd-team");

      await asClaims(client, { sub: organizer.authUserId });
      const teamId = await callCreateTeam(client, eventId, "Původní", [memberA.profileId]);
      await callUpdateTeam(client, {
        eventId,
        teamId,
        name: "Přejmenovaný",
        memberProfileIds: [memberC.profileId],
      });

      await client.query("reset role");
      const { rows } = await client.query<{
        name: string;
        updated_by_profile_id: string;
      }>("select name, updated_by_profile_id from public.birth_giving_teams where id = $1", [
        teamId,
      ]);
      expect(rows[0].name).toBe("Přejmenovaný");
      expect(rows[0].updated_by_profile_id).toBe(organizer.profileId);
      expect(await readTeamMembers(client, eventId, teamId)).toEqual([memberC.profileId]);
    });
  });

  it("clears the previous winner and sets the new one in a single call, and can toggle off", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const memberA = await insertVerifiedProfile(client, { name: "Member A" });
      const memberB = await insertVerifiedProfile(client, { name: "Member B" });
      const eventId = await insertEvent(client, organizer.profileId, "winner");

      await asClaims(client, { sub: organizer.authUserId });
      const teamOne = await callCreateTeam(client, eventId, "Alfa", [memberA.profileId]);
      const teamTwo = await callCreateTeam(client, eventId, "Beta", [memberB.profileId]);

      await callUpdateTeam(client, { eventId, teamId: teamOne, isWinner: true });
      await callUpdateTeam(client, { eventId, teamId: teamTwo, isWinner: true });

      await client.query("reset role");
      const { rows } = await client.query<{ id: string; is_winner: boolean }>(
        "select id, is_winner from public.birth_giving_teams where event_id = $1 order by name",
        [eventId],
      );
      expect(rows).toEqual([
        { id: teamOne, is_winner: false },
        { id: teamTwo, is_winner: true },
      ]);

      // Toggle the winner off explicitly.
      await asClaims(client, { sub: organizer.authUserId });
      await callUpdateTeam(client, { eventId, teamId: teamTwo, isWinner: false });
      await client.query("reset role");
      const { rows: afterOff } = await client.query<{ is_winner: boolean }>(
        "select is_winner from public.birth_giving_teams where id = $1",
        [teamTwo],
      );
      expect(afterOff[0].is_winner).toBe(false);
    });
  });

  it("rolls back the whole team update when membership synchronization fails", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const memberA = await insertVerifiedProfile(client, { name: "Member A" });
      const memberB = await insertVerifiedProfile(client, { name: "Member B" });
      const eventId = await insertEvent(client, organizer.profileId, "rollback");

      await asClaims(client, { sub: organizer.authUserId });
      const teamId = await callCreateTeam(client, eventId, "Alfa", [memberA.profileId]);
      await callCreateTeam(client, eventId, "Beta", [memberB.profileId]);

      // Supplying memberB (already in the other team) makes the member sync
      // violate the one-team-per-event constraint; the entire update must be
      // rolled back, including the name and winner changes.
      await expectSqlState(client, "23505", () =>
        callUpdateTeam(client, {
          eventId,
          teamId,
          name: "Nezměněno!",
          memberProfileIds: [memberB.profileId],
          isWinner: true,
        }),
      );

      await client.query("reset role");
      const { rows } = await client.query<{ name: string; is_winner: boolean }>(
        "select name, is_winner from public.birth_giving_teams where id = $1",
        [teamId],
      );
      expect(rows[0].name).toBe("Alfa");
      expect(rows[0].is_winner).toBe(false);
      expect(await readTeamMembers(client, eventId, teamId)).toEqual([memberA.profileId]);
    });
  });

  it("deletes a team and its members atomically, organizer-only, allowing non-winner deletion", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const memberA = await insertVerifiedProfile(client, { name: "Member A" });
      const memberB = await insertVerifiedProfile(client, { name: "Member B" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const eventId = await insertEvent(client, organizer.profileId, "del-team");

      await asClaims(client, { sub: organizer.authUserId });
      const doomed = await callCreateTeam(client, eventId, "Odstraněný", [memberA.profileId]);
      const survivor = await callCreateTeam(client, eventId, "Přeživší", [memberB.profileId]);

      // A non-organizer cannot delete.
      await asClaims(client, { sub: outsider.authUserId });
      await expectSqlState(client, "42501", () => callDeleteTeam(client, eventId, doomed));

      // The organizer deletes the non-winner team and its members atomically.
      await asClaims(client, { sub: organizer.authUserId });
      await callDeleteTeam(client, eventId, doomed);

      await client.query("reset role");
      const { rows: teams } = await client.query<{ id: string }>(
        "select id from public.birth_giving_teams where event_id = $1",
        [eventId],
      );
      expect(teams).toEqual([{ id: survivor }]);
      const { rows: lingering } = await client.query(
        "select id from public.birth_giving_team_members where event_id = $1 and team_id = $2",
        [eventId, doomed],
      );
      expect(lingering).toEqual([]);
      expect(await readTeamMembers(client, eventId, survivor)).toEqual([memberB.profileId]);
    });
  });

  it("still denies organizer direct writes to teams and members", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "direct");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Přímý");

      await asClaims(client, { sub: organizer.authUserId });

      await expectRlsDenied(client, () =>
        client.query(
          `insert into public.birth_giving_teams (
             event_id, name, created_by_profile_id, updated_by_profile_id
           ) values ($1, 'Hack', $2, $2)`,
          [eventId, organizer.profileId],
        ),
      );

      await expectRlsDenied(client, () =>
        client.query(
          `insert into public.birth_giving_team_members (
             event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id
           ) values ($1, $2, $3, $3, $3)`,
          [eventId, teamId, organizer.profileId],
        ),
      );

      const teamUpdate = await client.query(
        "update public.birth_giving_teams set name = 'Hack' where id = $1",
        [teamId],
      );
      expect(teamUpdate.rowCount).toBe(0);

      const memberUpdate = await client.query(
        "update public.birth_giving_team_members set confirmed_at = now() where team_id = $1",
        [teamId],
      );
      expect(memberUpdate.rowCount).toBe(0);

      const teamDelete = await client.query(
        "delete from public.birth_giving_teams where id = $1",
        [teamId],
      );
      expect(teamDelete.rowCount).toBe(0);
    });
  });
});
