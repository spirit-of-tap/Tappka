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
    throw new Error("Expected row-level security denial");
  } catch (error: unknown) {
    await client.query("rollback to savepoint expected_rls_denial");
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/row-level security/i);
  } finally {
    await client.query("release savepoint expected_rls_denial");
  }
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
