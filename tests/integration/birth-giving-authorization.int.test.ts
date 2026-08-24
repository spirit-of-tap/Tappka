import type { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import { insertAuthUser, insertVerifiedProfile } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import { getPool } from "@/tests/setup/testdb";
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

// A denied statement aborts the outer transaction, so wrap each expected
// rejection in a savepoint to keep the transaction usable for later asserts.
// Before the Task 5 grants, direct writes were stopped by RLS (no INSERT/
// UPDATE/DELETE policy). After the privilege grant split, authenticated has
// SELECT-only column grants, so the same writes are stopped by the privilege
// layer ("permission denied for table") before RLS is even consulted. Both
// are valid, indistinguishable-intent denials for the same authorization rule.
async function expectWriteDenied(
  client: PoolClient,
  operation: () => Promise<unknown>,
): Promise<void> {
  await client.query("savepoint expected_write_denial");
  try {
    await operation();
    throw new Error("Expected write denial but operation succeeded");
  } catch (error: unknown) {
    await client.query("rollback to savepoint expected_write_denial");
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/row-level security|permission denied/i);
  } finally {
    await client.query("release savepoint expected_write_denial");
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

      // Task 5 revokes ALL table privileges from authenticated and re-grants
      // SELECT-only column privileges, so direct writes are rejected at the
      // privilege layer (the failure mode moved from RLS to permissions).
      await expectWriteDenied(client, () =>
        client.query(
          `insert into public.birth_giving_events (
             name, customer, starts_at, duration, status, organizer_profile_ids,
             created_by_profile_id, updated_by_profile_id
           ) values ('Nope', 'Customer', $1, '8h', 'draft', $2::uuid[], $3, $3)`,
          [futureTimestamp(), [caller.profileId], caller.profileId],
        ),
      );

      await expectWriteDenied(client, () =>
        client.query(
          `insert into public.birth_giving_teams (
             event_id, name, created_by_profile_id, updated_by_profile_id
           ) values ($1, 'Nope team', $2, $2)`,
          [eventId, caller.profileId],
        ),
      );

      await expectWriteDenied(
        client,
        () =>
          client.query(
            `insert into public.birth_giving_team_members (
               event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id
             ) values ($1, $2, $3, $3, $3)`,
            [eventId, teamId, caller.profileId],
          ),
      );

      await expectWriteDenied(client, () =>
        client.query("update public.birth_giving_events set name = 'Hacked' where id = $1", [
          eventId,
        ]),
      );

      await expectWriteDenied(client, () =>
        client.query("update public.birth_giving_teams set name = 'Hacked' where id = $1", [
          teamId,
        ]),
      );

      await expectWriteDenied(client, () =>
        client.query(
          "update public.birth_giving_team_members set confirmed_at = now() where team_id = $1",
          [teamId],
        ),
      );

      await expectWriteDenied(client, () =>
        client.query("delete from public.birth_giving_events where id = $1", [eventId]),
      );

      await expectWriteDenied(client, () =>
        client.query("delete from public.birth_giving_teams where id = $1", [teamId]),
      );

      await expectWriteDenied(client, () =>
        client.query("delete from public.birth_giving_team_members where team_id = $1", [teamId]),
      );

      // Even the event organizer cannot mutate rows directly: reads are the
      // only table-level access; mutations arrive through functions later.
      await asClaims(client, { sub: organizer.authUserId });
      await expectWriteDenied(client, () =>
        client.query("update public.birth_giving_events set name = 'Hacked' where id = $1", [
          eventId,
        ]),
      );
      await expectWriteDenied(client, () =>
        client.query("delete from public.birth_giving_teams where id = $1", [teamId]),
      );
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

  // Kept members carry user-authored reflection columns plus confirmation and
  // provenance metadata. Syncing a roster on a published event must never wipe
  // or rewrite those rows: the old implementation deleted every membership and
  // re-inserted them, silently discarding reflections and resetting
  // confirmed_at / created_by / updated_by. Direct membership writes are
  // denied to authenticated callers by RLS, so the reflection is seeded as
  // admin (the default connection role in this suite), matching how the
  // Task-3/4 mutation surface leaves those columns to app-level routes.
  it("preserves reflections, confirmation, and provenance for retained members while syncing a published roster", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const keptMember = await insertVerifiedProfile(client, { name: "Kept Member" });
      const removedMember = await insertVerifiedProfile(client, { name: "Removed Member" });
      const newMember = await insertVerifiedProfile(client, { name: "New Member" });
      const eventId = await insertEvent(client, organizer.profileId, "pub-sync", "published");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Synced team");

      await insertMember(client, eventId, teamId, keptMember.profileId, organizer.profileId);
      await insertMember(client, eventId, teamId, removedMember.profileId, organizer.profileId);

      // Seed a stored reflection on the member who is about to be retained.
      const reflectionSubmittedAt = "2026-01-10T10:00:00.000Z";
      await client.query(
        `update public.birth_giving_team_members
            set reflection_contribution = $1,
                reflection_learning = $2,
                reflection_submitted_at = $3
          where team_id = $4 and profile_id = $5`,
        [
          "Stáhl jsem tým dohromady",
          "Naučil jsem se delegovat",
          reflectionSubmittedAt,
          teamId,
          keptMember.profileId,
        ],
      );

      interface MemberRow {
        id: string;
        confirmed_at: string;
        reflection_contribution: string | null;
        reflection_learning: string | null;
        reflection_submitted_at: string | null;
        created_by_profile_id: string;
        created_at: string;
        updated_at: string;
      }
      const readMemberRow = async (profileId: string): Promise<MemberRow> => {
        const { rows } = await client.query(
          `select id, confirmed_at, reflection_contribution, reflection_learning,
                  reflection_submitted_at, created_by_profile_id, created_at, updated_at
             from public.birth_giving_team_members
            where team_id = $1 and profile_id = $2`,
          [teamId, profileId],
        );
        const row = rows[0] as {
          id: string;
          confirmed_at: Date;
          reflection_contribution: string | null;
          reflection_learning: string | null;
          reflection_submitted_at: Date | null;
          created_by_profile_id: string;
          created_at: Date;
          updated_at: Date;
        };
        return {
          id: row.id,
          confirmed_at: row.confirmed_at.toISOString(),
          reflection_contribution: row.reflection_contribution,
          reflection_learning: row.reflection_learning,
          reflection_submitted_at: row.reflection_submitted_at
            ? row.reflection_submitted_at.toISOString()
            : null,
          created_by_profile_id: row.created_by_profile_id,
          created_at: row.created_at.toISOString(),
          updated_at: row.updated_at.toISOString(),
        };
      };

      const keptBefore = await readMemberRow(keptMember.profileId);

      // Keep the reflecting member and add a new one; the removed member drops
      // off and the organizer (caller) is appended because the event is
      // published.
      await asClaims(client, { sub: organizer.authUserId });
      await callUpdateTeam(client, {
        eventId,
        teamId,
        memberProfileIds: [keptMember.profileId, newMember.profileId],
      });
      await client.query("reset role");

      // The retained member is bit-for-bit untouched: id, confirmation,
      // reflection, provenance, and timestamps all unchanged.
      const keptAfter = await readMemberRow(keptMember.profileId);
      expect(keptAfter.id).toBe(keptBefore.id);
      expect(keptAfter.confirmed_at).toBe(keptBefore.confirmed_at);
      expect(keptAfter.reflection_contribution).toBe(keptBefore.reflection_contribution);
      expect(keptAfter.reflection_learning).toBe(keptBefore.reflection_learning);
      expect(keptAfter.reflection_submitted_at).toBe(keptBefore.reflection_submitted_at);
      expect(keptAfter.created_by_profile_id).toBe(keptBefore.created_by_profile_id);
      expect(keptAfter.created_at).toBe(keptBefore.created_at);
      expect(keptAfter.updated_at).toBe(keptBefore.updated_at);

      // The new member was added, the caller (organizer) is present, and the
      // removed member is gone.
      const members = await readTeamMembers(client, eventId, teamId);
      expect(members).toEqual(
        [keptMember.profileId, newMember.profileId, organizer.profileId].sort(),
      );

      // A no-op resubmission of the identical set leaves every membership row
      // byte-identical -- the correct implementation must not delete/re-insert.
      const beforeNoop = await Promise.all(members.map((profileId) => readMemberRow(profileId)));
      await asClaims(client, { sub: organizer.authUserId });
      await callUpdateTeam(client, {
        eventId,
        teamId,
        memberProfileIds: [keptMember.profileId, newMember.profileId],
      });
      await client.query("reset role");
      const afterNoop = await Promise.all(
        (await readTeamMembers(client, eventId, teamId)).map((profileId) =>
          readMemberRow(profileId),
        ),
      );
      expect(afterNoop).toEqual(beforeNoop);
    });
  });

  // Defense-in-depth: a cancelled team must never become a winner, matching
  // the predicate of the partial unique index (is_winner AND cancelled_at IS
  // NULL). No team-cancel function exists yet, so the cancelled_at is seeded
  // directly; the winner guard keeps state consistent if/when cancellation
  // lands.
  it("never lets a cancelled team become a winner, mirroring the partial unique index", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "cancelled-winner");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Zrušený tým");

      await client.query(
        `update public.birth_giving_teams
            set cancelled_at = $2, cancellation_reason = 'Zrušený tým'
          where id = $1`,
        [teamId, pastTimestamp()],
      );

      await asClaims(client, { sub: organizer.authUserId });
      await callUpdateTeam(client, { eventId, teamId, isWinner: true });
      await client.query("reset role");

      const { rows } = await client.query<{
        is_winner: boolean;
        cancelled_at: string | null;
      }>("select is_winner, cancelled_at from public.birth_giving_teams where id = $1", [
        teamId,
      ]);
      expect(rows[0].cancelled_at).not.toBeNull();
      expect(rows[0].is_winner).toBe(false);
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

      await expectWriteDenied(client, () =>
        client.query(
          `insert into public.birth_giving_teams (
             event_id, name, created_by_profile_id, updated_by_profile_id
           ) values ($1, 'Hack', $2, $2)`,
          [eventId, organizer.profileId],
        ),
      );

      await expectWriteDenied(client, () =>
        client.query(
          `insert into public.birth_giving_team_members (
             event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id
           ) values ($1, $2, $3, $3, $3)`,
          [eventId, teamId, organizer.profileId],
        ),
      );

      await expectWriteDenied(client, () =>
        client.query("update public.birth_giving_teams set name = 'Hack' where id = $1", [
          teamId,
        ]),
      );

      await expectWriteDenied(client, () =>
        client.query(
          "update public.birth_giving_team_members set confirmed_at = now() where team_id = $1",
          [teamId],
        ),
      );

      await expectWriteDenied(client, () =>
        client.query("delete from public.birth_giving_teams where id = $1", [teamId]),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Task 5: assignment, result, reflection, visibility, and trigger RPCs.
// ---------------------------------------------------------------------------

interface VisibleAssignment {
  assignment_state: string | null;
  assignment_storage_path: string | null;
  assignment_file_name: string | null;
  assignment_mime_type: string | null;
  assignment_file_size: number | null;
  assignment_uploaded_at: string | null;
  assignment_uploaded_by_profile_id: string | null;
}

function assignmentPrefix(eventId: string): string {
  return `birth-giving/assignments/${eventId}/`;
}

function resultPrefix(eventId: string, teamId: string): string {
  return `birth-giving/results/${eventId}/${teamId}/`;
}

async function callSetAssignment(
  client: PoolClient,
  args: {
    eventId: string;
    state: string;
    storagePath?: string | null;
    originalFileName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
  },
): Promise<string | null> {
  const { rows } = await client.query<{ previous_path: string | null }>(
    `select public.birth_giving_set_assignment(
       $1::uuid, $2::public.birth_giving_assignment_state,
       $3::text, $4::text, $5::text, $6::bigint
     ) as previous_path`,
    [
      args.eventId,
      args.state,
      args.storagePath ?? null,
      args.originalFileName ?? null,
      args.mimeType ?? null,
      args.fileSize ?? null,
    ],
  );
  return rows[0].previous_path;
}

async function callGetVisibleAssignment(
  client: PoolClient,
  eventId: string,
): Promise<VisibleAssignment | null> {
  const { rows } = await client.query<VisibleAssignment>(
    `select assignment_state, assignment_storage_path, assignment_file_name,
            assignment_mime_type, assignment_file_size, assignment_uploaded_at,
            assignment_uploaded_by_profile_id
       from public.birth_giving_get_visible_assignment($1::uuid)`,
    [eventId],
  );
  return rows[0] ?? null;
}

async function readEventAssignmentColumns(
  client: PoolClient,
  eventId: string,
): Promise<VisibleAssignment> {
  const { rows } = await client.query<VisibleAssignment>(
    `select assignment_state, assignment_storage_path, assignment_file_name,
            assignment_mime_type, assignment_file_size, assignment_uploaded_at,
            assignment_uploaded_by_profile_id
       from public.birth_giving_events
      where id = $1`,
    [eventId],
  );
  return rows[0];
}

async function callAddResultFile(
  client: PoolClient,
  args: {
    eventId: string;
    teamId: string;
    storagePath: string;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
  },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `select public.birth_giving_add_result_file(
       $1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::bigint
     ) as id`,
    [
      args.eventId,
      args.teamId,
      args.storagePath,
      args.originalFileName,
      args.mimeType,
      args.fileSize,
    ],
  );
  return rows[0].id;
}

async function callRemoveResultFile(client: PoolClient, fileId: string): Promise<string> {
  const { rows } = await client.query<{ path: string }>(
    "select public.birth_giving_remove_result_file($1::uuid) as path",
    [fileId],
  );
  return rows[0].path;
}

async function callMarkResultMissing(
  client: PoolClient,
  eventId: string,
  teamId: string,
): Promise<string[]> {
  const { rows } = await client.query<{ paths: string[] }>(
    "select public.birth_giving_mark_result_missing($1::uuid, $2::uuid) as paths",
    [eventId, teamId],
  );
  return rows[0].paths;
}

async function callUpsertReflection(
  client: PoolClient,
  args: { eventId: string; contribution: string; learning: string },
): Promise<void> {
  await client.query(
    "select public.birth_giving_upsert_reflection($1::uuid, $2::text, $3::text)",
    [args.eventId, args.contribution, args.learning],
  );
}

async function readTeamResults(
  client: PoolClient,
  teamId: string,
): Promise<{ result_state: string; result_files: unknown }> {
  const { rows } = await client.query<{ result_state: string; result_files: unknown }>(
    "select result_state, result_files from public.birth_giving_teams where id = $1",
    [teamId],
  );
  return rows[0];
}

// Deletes rows committed by cross-transaction tests (which cannot use
// withRollback) so the shared test database stays clean for later tests.
async function purgeBirthGivingRows(
  client: PoolClient,
  actors: { authUserId: string; profileId: string }[],
  eventId: string,
): Promise<void> {
  await client.query("begin");
  try {
    await client.query("delete from public.birth_giving_events where id = $1", [eventId]);
    await client.query(
      "delete from public.profiles where id = any($1::uuid[])",
      [actors.map((actor) => actor.profileId)],
    );
    await client.query(
      "delete from auth.users where id = any($1::uuid[])",
      [actors.map((actor) => actor.authUserId)],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

describe("Birth Giving assignment mutation security", () => {
  it("denies assignment changes to inactive, revoked, non-beta, or unverified callers", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "assign-inactive");
      const inactiveAuthIds = await seedInactiveCallerAuthIds(client);

      for (const authUserId of inactiveAuthIds) {
        await asClaims(client, { sub: authUserId });
        await expectSqlState(client, "42501", () =>
          callSetAssignment(client, {
            eventId,
            state: "present",
            storagePath: `${assignmentPrefix(eventId)}zadani.pdf`,
            originalFileName: "zadani.pdf",
            mimeType: "application/pdf",
            fileSize: 1024,
          }),
        );
        await expectSqlState(client, "42501", () =>
          callGetVisibleAssignment(client, eventId),
        );
        await client.query("reset role");
      }
    });
  });

  it("denies assignment changes to an active caller who is not an organizer", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const eventId = await insertEvent(client, organizer.profileId, "assign-outsider");

      await asClaims(client, { sub: outsider.authUserId });
      await expectSqlState(client, "42501", () =>
        callSetAssignment(client, {
          eventId,
          state: "present",
          storagePath: `${assignmentPrefix(eventId)}zadani.pdf`,
          originalFileName: "zadani.pdf",
          mimeType: "application/pdf",
          fileSize: 1024,
        }),
      );
      await expectSqlState(client, "42501", () =>
        callSetAssignment(client, { eventId, state: "missing" }),
      );
    });
  });

  it("lets an organizer set a present assignment with caller-derived audit fields", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "assign-present");

      const { rows: beforeRows } = await client.query<{ t: Date }>(
        "select clock_timestamp() as t",
      );
      const beforeCall = beforeRows[0].t.getTime();

      await asClaims(client, { sub: organizer.authUserId });
      const previous = await callSetAssignment(client, {
        eventId,
        state: "present",
        storagePath: `${assignmentPrefix(eventId)}zadani.pdf`,
        originalFileName: "zadani.pdf",
        mimeType: "application/pdf",
        fileSize: 2048,
      });
      expect(previous).toBeNull();

      const { rows: afterRows } = await client.query<{ t: Date }>(
        "select clock_timestamp() as t",
      );
      const afterCall = afterRows[0].t.getTime();

      await client.query("reset role");
      const assignment = await readEventAssignmentColumns(client, eventId);
      expect(assignment.assignment_state).toBe("present");
      expect(assignment.assignment_storage_path).toBe(`${assignmentPrefix(eventId)}zadani.pdf`);
      expect(assignment.assignment_file_name).toBe("zadani.pdf");
      expect(assignment.assignment_mime_type).toBe("application/pdf");
      expect(Number(assignment.assignment_file_size)).toBe(2048);
      // uploaded_by/uploaded_at are derived from the caller, never client-supplied:
      // the uploader is the organizer and the timestamp is a fresh value between
      // the clock reads around the call.
      expect(assignment.assignment_uploaded_by_profile_id).toBe(organizer.profileId);
      expect(assignment.assignment_uploaded_at).not.toBeNull();
      const uploadedAt = new Date(assignment.assignment_uploaded_at as string).getTime();
      expect(uploadedAt).toBeGreaterThanOrEqual(beforeCall);
      expect(uploadedAt).toBeLessThanOrEqual(afterCall);
    });
  });

  it("returns the displaced path when an assignment is replaced", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "assign-replace");

      await asClaims(client, { sub: organizer.authUserId });
      const firstPath = `${assignmentPrefix(eventId)}v1.pdf`;
      expect(
        await callSetAssignment(client, {
          eventId,
          state: "present",
          storagePath: firstPath,
          originalFileName: "v1.pdf",
          mimeType: "application/pdf",
          fileSize: 100,
        }),
      ).toBeNull();

      const secondPath = `${assignmentPrefix(eventId)}v2.pdf`;
      const displaced = await callSetAssignment(client, {
        eventId,
        state: "present",
        storagePath: secondPath,
        originalFileName: "v2.pdf",
        mimeType: "application/pdf",
        fileSize: 200,
      });
      expect(displaced).toBe(firstPath);

      await client.query("reset role");
      const assignment = await readEventAssignmentColumns(client, eventId);
      expect(assignment.assignment_storage_path).toBe(secondPath);
      expect(assignment.assignment_uploaded_by_profile_id).toBe(organizer.profileId);
    });
  });

  it("clears assignment metadata on missing and returns the displaced path", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "assign-missing");

      await asClaims(client, { sub: organizer.authUserId });
      const previousPath = `${assignmentPrefix(eventId)}zadani.pdf`;
      await callSetAssignment(client, {
        eventId,
        state: "present",
        storagePath: previousPath,
        originalFileName: "zadani.pdf",
        mimeType: "application/pdf",
        fileSize: 2048,
      });

      const displaced = await callSetAssignment(client, { eventId, state: "missing" });
      expect(displaced).toBe(previousPath);

      await client.query("reset role");
      const assignment = await readEventAssignmentColumns(client, eventId);
      expect(assignment.assignment_state).toBe("missing");
      expect(assignment.assignment_storage_path).toBeNull();
      expect(assignment.assignment_file_name).toBeNull();
      expect(assignment.assignment_mime_type).toBeNull();
      expect(assignment.assignment_file_size).toBeNull();
      expect(assignment.assignment_uploaded_at).toBeNull();
      expect(assignment.assignment_uploaded_by_profile_id).toBeNull();
    });
  });

  it("rejects paths, metadata, and target states outside the assignment contract", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "assign-path");
      const otherEventId = await insertEvent(client, organizer.profileId, "assign-path-other");

      await asClaims(client, { sub: organizer.authUserId });

      // A path under the wrong event's prefix.
      await expectSqlState(client, "23514", () =>
        callSetAssignment(client, {
          eventId,
          state: "present",
          storagePath: `${assignmentPrefix(otherEventId)}nikdy.pdf`,
          originalFileName: "nikdy.pdf",
          mimeType: "application/pdf",
          fileSize: 1024,
        }),
      );
      // An external/unbounded path.
      await expectSqlState(client, "23514", () =>
        callSetAssignment(client, {
          eventId,
          state: "present",
          storagePath: "documents/secret/kurz.pdf",
          originalFileName: "kurz.pdf",
          mimeType: "application/pdf",
          fileSize: 1024,
        }),
      );
      // Traversal: matches the prefix but climbs out with `..`.
      await expectSqlState(client, "23514", () =>
        callSetAssignment(client, {
          eventId,
          state: "present",
          storagePath: `${assignmentPrefix(eventId)}../jine-kurzy/unik.pdf`,
          originalFileName: "unik.pdf",
          mimeType: "application/pdf",
          fileSize: 1024,
        }),
      );
      // Incomplete metadata.
      await expectSqlState(client, "23514", () =>
        callSetAssignment(client, {
          eventId,
          state: "present",
          storagePath: `${assignmentPrefix(eventId)}zadani.pdf`,
          originalFileName: "zadani.pdf",
          mimeType: "application/pdf",
          fileSize: 0,
        }),
      );
      await expectSqlState(client, "23514", () =>
        callSetAssignment(client, {
          eventId,
          state: "present",
          storagePath: `${assignmentPrefix(eventId)}zadani.pdf`,
          originalFileName: "zadani.pdf",
          mimeType: null,
          fileSize: 1024,
        }),
      );
      // `none` is a creation-time state, not a transition target.
      await expectSqlState(client, "23514", () =>
        callSetAssignment(client, { eventId, state: "none" }),
      );
    });
  });
});

describe("Birth Giving assignment visibility", () => {
  it("always shows the real assignment to an organizer, even before the event starts", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "vis-org");
      const path = `${assignmentPrefix(eventId)}zadani.pdf`;

      await asClaims(client, { sub: organizer.authUserId });
      await callSetAssignment(client, {
        eventId,
        state: "present",
        storagePath: path,
        originalFileName: "zadani.pdf",
        mimeType: "application/pdf",
        fileSize: 2048,
      });

      const visible = await callGetVisibleAssignment(client, eventId);
      expect(visible).toEqual({
        assignment_state: "present",
        assignment_storage_path: path,
        assignment_file_name: "zadani.pdf",
        assignment_mime_type: "application/pdf",
        assignment_file_size: expect.any(String) as unknown as number,
        assignment_uploaded_at: expect.any(Date) as unknown as string,
        assignment_uploaded_by_profile_id: organizer.profileId,
      });
    });
  });

  it("embargoes a non-organizer before starts_at: blurred row even when an assignment exists", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const withAssignment = await insertEvent(client, organizer.profileId, "vis-embargo-has");
      const withoutAssignment = await insertEvent(
        client,
        organizer.profileId,
        "vis-embargo-none",
      );

      await asClaims(client, { sub: organizer.authUserId });
      await callSetAssignment(client, {
        eventId: withAssignment,
        state: "present",
        storagePath: `${assignmentPrefix(withAssignment)}zadani.pdf`,
        originalFileName: "zadani.pdf",
        mimeType: "application/pdf",
        fileSize: 2048,
      });

      // A non-organizer sees the exact same blurred row whether or not an
      // assignment exists -- the embargo leaks nothing about the assignment.
      await asClaims(client, { sub: outsider.authUserId });
      const blurredWith = await callGetVisibleAssignment(client, withAssignment);
      const blurredWithout = await callGetVisibleAssignment(client, withoutAssignment);
      const blurred = {
        assignment_state: "none",
        assignment_storage_path: null,
        assignment_file_name: null,
        assignment_mime_type: null,
        assignment_file_size: null,
        assignment_uploaded_at: null,
        assignment_uploaded_by_profile_id: null,
      };
      expect(blurredWith).toEqual(blurred);
      expect(blurredWithout).toEqual(blurred);
    });
  });

  it("reveals the real assignment to a non-organizer at or after starts_at", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const eventId = await insertEvent(client, organizer.profileId, "vis-reveal");
      const path = `${assignmentPrefix(eventId)}zadani.pdf`;

      await asClaims(client, { sub: organizer.authUserId });
      await callSetAssignment(client, {
        eventId,
        state: "present",
        storagePath: path,
        originalFileName: "zadani.pdf",
        mimeType: "application/pdf",
        fileSize: 2048,
      });

      // Move the event into the past (admin seeding; RLS would hide the draft).
      await client.query("reset role");
      await client.query(
        "update public.birth_giving_events set starts_at = now() - interval '1 hour' where id = $1",
        [eventId],
      );

      await asClaims(client, { sub: outsider.authUserId });
      const visible = await callGetVisibleAssignment(client, eventId);
      expect(visible?.assignment_state).toBe("present");
      expect(visible?.assignment_storage_path).toBe(path);
      expect(visible?.assignment_uploaded_by_profile_id).toBe(organizer.profileId);
    });
  });

  it("treats the exact starts_at boundary as released", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const eventId = await insertEvent(client, organizer.profileId, "vis-boundary");
      const path = `${assignmentPrefix(eventId)}zadani.pdf`;

      await asClaims(client, { sub: organizer.authUserId });
      await callSetAssignment(client, {
        eventId,
        state: "present",
        storagePath: path,
        originalFileName: "zadani.pdf",
        mimeType: "application/pdf",
        fileSize: 2048,
      });

      // `now()` is stable inside the transaction, so an exact-boundary event is
      // revealed by the `starts_at <= now()` rule.
      await client.query("reset role");
      await client.query(
        "update public.birth_giving_events set starts_at = now() where id = $1",
        [eventId],
      );

      await asClaims(client, { sub: outsider.authUserId });
      const visible = await callGetVisibleAssignment(client, eventId);
      expect(visible?.assignment_state).toBe("present");
      expect(visible?.assignment_storage_path).toBe(path);
    });
  });

  it("returns no row for nonexistent or removed events", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "vis-missing");
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });

      await client.query("reset role");
      await client.query(
        `update public.birth_giving_events
            set removed_at = now(), removed_by_profile_id = $2
          where id = $1`,
        [eventId, organizer.profileId],
      );

      await asClaims(client, { sub: outsider.authUserId });
      expect(
        await callGetVisibleAssignment(client, "00000000-0000-0000-0000-000000000000"),
      ).toBeNull();
      expect(await callGetVisibleAssignment(client, eventId)).toBeNull();

      // The organizer gets no row either once the event is removed.
      await asClaims(client, { sub: organizer.authUserId });
      expect(await callGetVisibleAssignment(client, eventId)).toBeNull();
    });
  });
});

describe("Birth Giving result file mutation security", () => {
  it("lets an organizer or a matching team member add a result file; denies everyone else", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const eventId = await insertEvent(client, organizer.profileId, "result-add");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Výsledkový tým");
      await insertMember(client, eventId, teamId, member.profileId, organizer.profileId);

      const path = `${resultPrefix(eventId, teamId)}vysledek.pdf`;
      const upload = (_actor: { authUserId: string }) =>
        callAddResultFile(client, {
          eventId,
          teamId,
          storagePath: path,
          originalFileName: "vysledek.pdf",
          mimeType: "application/pdf",
          fileSize: 4096,
        });

      await asClaims(client, { sub: outsider.authUserId });
      await expectSqlState(client, "42501", () => upload(outsider));

      // A team member can upload results...
      await asClaims(client, { sub: member.authUserId });
      const memberFileId = await upload(member);
      // ...and so can the organizer.
      await asClaims(client, { sub: organizer.authUserId });
      const organizerFileId = await upload(organizer);

      await client.query("reset role");
      const { result_state, result_files } = await readTeamResults(client, teamId);
      expect(result_state).toBe("present");
      const files = result_files as {
        id: string;
        storage_path: string;
        original_file_name: string;
        mime_type: string;
        file_size: number;
        uploaded_at: string;
        uploaded_by_profile_id: string;
      }[];
      expect(files).toHaveLength(2);
      for (const file of files) {
        expect(file.storage_path).toBe(path);
        expect(file.original_file_name).toBe("vysledek.pdf");
        expect(file.mime_type).toBe("application/pdf");
        expect(file.file_size).toBe(4096);
        expect(file.uploaded_at).toBeTruthy();
      }
      expect(
        files.map((file) => file.id).sort(),
      ).toEqual([memberFileId, organizerFileId].sort());
      expect(
        files.map((file) => file.uploaded_by_profile_id).sort(),
      ).toEqual([member.profileId, organizer.profileId].sort());
    });
  });

  it("rejects result paths outside the event and team prefix", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "result-path");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Cesta tým");
      const otherTeamId = await insertTeam(client, eventId, organizer.profileId, "Cesta tým 2");

      await asClaims(client, { sub: organizer.authUserId });
      // Wrong team prefix.
      await expectSqlState(client, "23514", () =>
        callAddResultFile(client, {
          eventId,
          teamId,
          storagePath: `${resultPrefix(eventId, otherTeamId)}jine.pdf`,
          originalFileName: "jine.pdf",
          mimeType: "application/pdf",
          fileSize: 1024,
        }),
      );
      // Outside the bucket entirely.
      await expectSqlState(client, "23514", () =>
        callAddResultFile(client, {
          eventId,
          teamId,
          storagePath: "documents/vysledky/tajne.pdf",
          originalFileName: "tajne.pdf",
          mimeType: "application/pdf",
          fileSize: 1024,
        }),
      );
      // Traversal.
      await expectSqlState(client, "23514", () =>
        callAddResultFile(client, {
          eventId,
          teamId,
          storagePath: `${resultPrefix(eventId, teamId)}../utek.pdf`,
          originalFileName: "utek.pdf",
          mimeType: "application/pdf",
          fileSize: 1024,
        }),
      );
      // Incomplete metadata.
      await expectSqlState(client, "23514", () =>
        callAddResultFile(client, {
          eventId,
          teamId,
          storagePath: `${resultPrefix(eventId, teamId)}maly.pdf`,
          originalFileName: "maly.pdf",
          mimeType: "application/pdf",
          fileSize: -1,
        }),
      );
    });
  });

  it("removes one result file, returns its path, and moves pending when it was the last", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const eventId = await insertEvent(client, organizer.profileId, "result-remove");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Odstraň tým");
      await insertMember(client, eventId, teamId, member.profileId, organizer.profileId);

      const firstPath = `${resultPrefix(eventId, teamId)}prvni.pdf`;
      const secondPath = `${resultPrefix(eventId, teamId)}druhy.pdf`;
      await asClaims(client, { sub: organizer.authUserId });
      const firstId = await callAddResultFile(client, {
        eventId,
        teamId,
        storagePath: firstPath,
        originalFileName: "prvni.pdf",
        mimeType: "application/pdf",
        fileSize: 100,
      });
      const secondId = await callAddResultFile(client, {
        eventId,
        teamId,
        storagePath: secondPath,
        originalFileName: "druhy.pdf",
        mimeType: "application/pdf",
        fileSize: 200,
      });

      // A non-member cannot remove either file.
      await asClaims(client, { sub: outsider.authUserId });
      await expectSqlState(client, "42501", () => callRemoveResultFile(client, firstId));

      // A team member removes one file and receives its storage path.
      await asClaims(client, { sub: member.authUserId });
      expect(await callRemoveResultFile(client, firstId)).toBe(firstPath);
      await client.query("reset role");
      let team = await readTeamResults(client, teamId);
      expect(team.result_state).toBe("present");
      expect(
        (team.result_files as { id: string }[]).map((file) => file.id),
      ).toEqual([secondId]);

      // Removing the last file flips the state back to pending.
      await asClaims(client, { sub: organizer.authUserId });
      expect(await callRemoveResultFile(client, secondId)).toBe(secondPath);
      await client.query("reset role");
      team = await readTeamResults(client, teamId);
      expect(team.result_state).toBe("pending");
      expect(team.result_files).toEqual([]);

      // An unknown file id is P0002, never a silent no-op.
      await asClaims(client, { sub: organizer.authUserId });
      await expectSqlState(client, "P0002", () =>
        callRemoveResultFile(client, "00000000-0000-0000-0000-000000000000"),
      );
    });
  });

  it("marks a team's results missing, clears its files, and returns every storage path", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const eventId = await insertEvent(client, organizer.profileId, "result-missing");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Missing tým");
      await insertMember(client, eventId, teamId, member.profileId, organizer.profileId);

      const firstPath = `${resultPrefix(eventId, teamId)}prvni.pdf`;
      const secondPath = `${resultPrefix(eventId, teamId)}druhy.pdf`;
      await asClaims(client, { sub: organizer.authUserId });
      await callAddResultFile(client, {
        eventId,
        teamId,
        storagePath: firstPath,
        originalFileName: "prvni.pdf",
        mimeType: "application/pdf",
        fileSize: 100,
      });
      await callAddResultFile(client, {
        eventId,
        teamId,
        storagePath: secondPath,
        originalFileName: "druhy.pdf",
        mimeType: "application/pdf",
        fileSize: 200,
      });

      await asClaims(client, { sub: outsider.authUserId });
      await expectSqlState(client, "42501", () =>
        callMarkResultMissing(client, eventId, teamId),
      );

      await asClaims(client, { sub: member.authUserId });
      const displaced = await callMarkResultMissing(client, eventId, teamId);
      expect(displaced.sort()).toEqual([firstPath, secondPath].sort());

      await client.query("reset role");
      const team = await readTeamResults(client, teamId);
      expect(team.result_state).toBe("missing");
      expect(team.result_files).toEqual([]);
    });
  });

  it("preserves both appends when two transactions race on the same team (row lock)", async () => {
    const pool = getPool();
    const writer1 = await pool.connect();
    const writer2 = await pool.connect();
    const cleanup = await pool.connect();
    try {
      // Setup runs in its own committed transaction because the writers need
      // to see it and lock the team row.
      await writer1.query("begin");
      const organizer = await insertVerifiedProfile(writer1, { name: "Conc organizer" });
      const eventId = await insertEvent(writer1, organizer.profileId, "result-conc");
      const teamId = await insertTeam(writer1, eventId, organizer.profileId, "Závod tým");
      await writer1.query("commit");

      await writer1.query("begin");
      await writer2.query("begin");
      await asClaims(writer1, { sub: organizer.authUserId });
      await asClaims(writer2, { sub: organizer.authUserId });

      // Writer 1 completes its append first and still holds the team row lock,
      // so writer 2's append must block on FOR UPDATE until writer 1 commits.
      const firstPath = `${resultPrefix(eventId, teamId)}prvni.pdf`;
      const secondPath = `${resultPrefix(eventId, teamId)}druhy.pdf`;
      const fileA = await callAddResultFile(writer1, {
        eventId,
        teamId,
        storagePath: firstPath,
        originalFileName: "prvni.pdf",
        mimeType: "application/pdf",
        fileSize: 100,
      });
      const pendingAppend = callAddResultFile(writer2, {
        eventId,
        teamId,
        storagePath: secondPath,
        originalFileName: "druhy.pdf",
        mimeType: "application/pdf",
        fileSize: 200,
      });
      await writer1.query("commit");
      const fileB = await pendingAppend;
      await writer2.query("commit");

      const verify = await pool.connect();
      try {
        await verify.query("begin");
        const { rows } = await verify.query<{ result_state: string; result_files: unknown }>(
          "select result_state, result_files from public.birth_giving_teams where id = $1",
          [teamId],
        );
        expect(rows[0].result_state).toBe("present");
        const files = rows[0].result_files as { id: string; storage_path: string }[];
        expect(files).toHaveLength(2);
        expect(files.map((file) => file.id).sort()).toEqual([fileA, fileB].sort());
        expect(files.map((file) => file.storage_path).sort()).toEqual(
          [firstPath, secondPath].sort(),
        );
        await verify.query("commit");
      } finally {
        await verify.query("rollback").catch(() => {});
        verify.release();
      }

      await purgeBirthGivingRows(cleanup, [organizer], eventId);
    } finally {
      for (const connection of [writer1, writer2, cleanup]) {
        await connection.query("rollback").catch(() => {});
        connection.release();
      }
    }
  });
});

describe("Birth Giving reflection security", () => {
  it("lets a member update only their own reflection and leaves other members untouched", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const memberOne = await insertVerifiedProfile(client, { name: "Member One" });
      const memberTwo = await insertVerifiedProfile(client, { name: "Member Two" });
      const eventId = await insertEvent(client, organizer.profileId, "reflection");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Reflexní tým");
      await insertMember(client, eventId, teamId, memberOne.profileId, organizer.profileId);
      await insertMember(client, eventId, teamId, memberTwo.profileId, organizer.profileId);

      await asClaims(client, { sub: memberOne.authUserId });
      await callUpsertReflection(client, {
        eventId,
        contribution: "Stáhl jsem tým dohromady",
        learning: "Naučil jsem se delegovat",
      });

      await client.query("reset role");
      const { rows } = await client.query<{
        profile_id: string;
        reflection_contribution: string | null;
        reflection_learning: string | null;
        reflection_submitted_at: Date | null;
        updated_by_profile_id: string;
      }>(
        `select profile_id, reflection_contribution, reflection_learning,
                reflection_submitted_at, updated_by_profile_id
           from public.birth_giving_team_members
          where event_id = $1
          order by profile_id`,
        [eventId],
      );
      expect(rows).toHaveLength(2);
      const byProfile = new Map(rows.map((row) => [row.profile_id, row]));
      expect(byProfile.get(memberOne.profileId)?.reflection_contribution).toBe(
        "Stáhl jsem tým dohromady",
      );
      expect(byProfile.get(memberOne.profileId)?.reflection_learning).toBe(
        "Naučil jsem se delegovat",
      );
      expect(byProfile.get(memberOne.profileId)?.reflection_submitted_at).not.toBeNull();
      expect(byProfile.get(memberOne.profileId)?.updated_by_profile_id).toBe(
        memberOne.profileId,
      );
      expect(byProfile.get(memberTwo.profileId)?.reflection_contribution).toBeNull();
      expect(byProfile.get(memberTwo.profileId)?.reflection_learning).toBeNull();
      expect(byProfile.get(memberTwo.profileId)?.reflection_submitted_at).toBeNull();
    });
  });

  it("denies reflections to non-members, removed events, and cancelled-team members", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const outsider = await insertVerifiedProfile(client, { name: "Outsider" });
      const eventId = await insertEvent(client, organizer.profileId, "refl-deny");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Zakázaný tým");
      await insertMember(client, eventId, teamId, member.profileId, organizer.profileId);

      // A non-member / non-organizer cannot submit a reflection.
      await asClaims(client, { sub: outsider.authUserId });
      await expectSqlState(client, "42501", () =>
        callUpsertReflection(client, {
          eventId,
          contribution: "Příspěvek",
          learning: "Učení",
        }),
      );

      // A member of a cancelled team cannot either (only active teams).
      await client.query("reset role");
      await client.query(
        `update public.birth_giving_teams
            set cancelled_at = now() - interval '1 hour', cancellation_reason = 'Zrušeno'
          where id = $1`,
        [teamId],
      );
      await asClaims(client, { sub: member.authUserId });
      await expectSqlState(client, "42501", () =>
        callUpsertReflection(client, {
          eventId,
          contribution: "Příspěvek",
          learning: "Učení",
        }),
      );

      // A member of a removed event cannot either.
      await client.query("reset role");
      await client.query(
        `update public.birth_giving_teams
            set cancelled_at = null, cancellation_reason = null
          where id = $1`,
        [teamId],
      );
      await client.query(
        `update public.birth_giving_events
            set removed_at = now(), removed_by_profile_id = $2
          where id = $1`,
        [eventId, organizer.profileId],
      );
      await asClaims(client, { sub: member.authUserId });
      await expectSqlState(client, "42501", () =>
        callUpsertReflection(client, {
          eventId,
          contribution: "Příspěvek",
          learning: "Učení",
        }),
      );
    });
  });
});

describe("Birth Giving table grants and column privileges", () => {
  it("restricts event assignment columns while keeping safe, team, and member columns readable", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const eventId = await insertEvent(client, organizer.profileId, "grants", "published");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Přístup tým");
      await insertMember(client, eventId, teamId, member.profileId, organizer.profileId);

      await asClaims(client, { sub: member.authUserId });

      // Safe event columns remain readable through RLS.
      const safe = await client.query(
        `select id, name, customer, starts_at, duration, status, organizer_profile_ids,
                removed_at, removed_by_profile_id, created_at, updated_at,
                created_by_profile_id, updated_by_profile_id
           from public.birth_giving_events
          where id = $1`,
        [eventId],
      );
      expect(safe.rows).toHaveLength(1);

      // All team and member columns remain readable.
      const teams = await client.query(
        "select id, name, is_winner, result_state, result_files from public.birth_giving_teams where id = $1",
        [teamId],
      );
      expect(teams.rows).toHaveLength(1);
      const memberships = await client.query(
        "select profile_id, reflection_contribution from public.birth_giving_team_members where team_id = $1",
        [teamId],
      );
      expect(memberships.rows).toHaveLength(1);

      // The seven assignment columns are NOT directly selectable; they are only
      // reachable through birth_giving_get_visible_assignment.
      await expectWriteDenied(client, () =>
        client.query(
          "select assignment_state from public.birth_giving_events where id = $1",
          [eventId],
        ),
      );
      await expectWriteDenied(client, () =>
        client.query(
          "select assignment_storage_path from public.birth_giving_events where id = $1",
          [eventId],
        ),
      );
      // Even a bare `select *` fails because the assignment columns are denied.
      await expectWriteDenied(client, () =>
        client.query("select * from public.birth_giving_events where id = $1", [eventId]),
      );
    });
  });

  it("fires the updated-at trigger so direct row updates advance updated_at", async () => {
    const pool = getPool();
    const actor = await pool.connect();
    const updater = await pool.connect();
    const cleanup = await pool.connect();
    let eventId = "";
    try {
      // Insert in its own transaction so the trigger's `now()` advances on the
      // later update (within one transaction now() is transaction-stable).
      await actor.query("begin");
      const organizer = await insertVerifiedProfile(actor, { name: "Trig organizer" });
      eventId = await insertEvent(actor, organizer.profileId, "trigger");
      const teamId = await insertTeam(actor, eventId, organizer.profileId, "Trigger tým");
      const member = await insertVerifiedProfile(actor, { name: "Trig member" });
      await insertMember(actor, eventId, teamId, member.profileId, organizer.profileId);
      await actor.query("commit");

      const readUpdatedAt = async (
        connection: typeof actor,
        table: "birth_giving_events" | "birth_giving_teams",
        id: string,
      ): Promise<number> => {
        const { rows } = await connection.query<{ updated_at: Date }>(
          `select updated_at from public.${table} where id = $1`,
          [id],
        );
        return rows[0].updated_at.getTime();
      };
      const readMemberUpdatedAt = async (
        connection: typeof actor,
        teamId: string,
      ): Promise<number> => {
        const { rows } = await connection.query<{ updated_at: Date }>(
          "select updated_at from public.birth_giving_team_members where team_id = $1 limit 1",
          [teamId],
        );
        return rows[0].updated_at.getTime();
      };

      const eventBefore = await readUpdatedAt(updater, "birth_giving_events", eventId);
      const teamBefore = await readUpdatedAt(updater, "birth_giving_teams", teamId);
      const memberBefore = await readMemberUpdatedAt(updater, teamId);

      // A plain UPDATE that never writes updated_at still advances it because
      // each table carries a BEFORE UPDATE handle_updated_at() trigger.
      await updater.query("begin");
      await updater.query(
        "update public.birth_giving_events set name = 'Triggered' where id = $1",
        [eventId],
      );
      await updater.query("update public.birth_giving_teams set name = 'Triggered' where id = $1", [
        teamId,
      ]);
      await updater.query(
        "update public.birth_giving_team_members set confirmed_at = now() where team_id = $1",
        [teamId],
      );
      await updater.query("commit");

      const eventAfter = await readUpdatedAt(updater, "birth_giving_events", eventId);
      const teamAfter = await readUpdatedAt(updater, "birth_giving_teams", teamId);
      const memberAfter = await readMemberUpdatedAt(updater, teamId);
      expect(eventAfter).toBeGreaterThan(eventBefore);
      expect(teamAfter).toBeGreaterThan(teamBefore);
      expect(memberAfter).toBeGreaterThan(memberBefore);

      await purgeBirthGivingRows(cleanup, [organizer, member], eventId);
    } finally {
      for (const connection of [actor, updater, cleanup]) {
        await connection.query("rollback").catch(() => {});
        connection.release();
      }
    }
  });
});
