import type { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import { insertVerifiedProfile } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

interface Actor {
  authUserId: string;
  profileId: string;
}

async function expectConstraintViolation(
  client: PoolClient,
  operation: () => Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  await client.query("savepoint expected_constraint_violation");
  try {
    await operation();
    throw new Error("Expected database constraint violation");
  } catch (error: unknown) {
    await client.query("rollback to savepoint expected_constraint_violation");
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(pattern);
  } finally {
    await client.query("release savepoint expected_constraint_violation");
  }
}

async function seedActors(client: PoolClient): Promise<{ organizer: Actor; member: Actor; other: Actor }> {
  return {
    organizer: await insertVerifiedProfile(client, { name: "Organizer" }),
    member: await insertVerifiedProfile(client, { name: "Member" }),
    other: await insertVerifiedProfile(client, { name: "Other" }),
  };
}

async function insertEvent(
  client: PoolClient,
  organizer: Actor,
  status: "draft" | "published" = "published",
  suffix = "main",
  startsAt = "2026-09-01T08:00:00Z",
): Promise<string> {
  const { rows } = await client.query(
    `insert into public.birth_giving_events
       (name, normalized_name, customer, normalized_customer, starts_at, duration,
        minimum_team_size, maximum_team_size, joining_open, status,
        created_by_profile_id, updated_by_profile_id)
     values ($1, $2, 'Customer', 'customer', $5, '8h',
             1, 4, true, $3, $4, $4)
     returning id`,
    [`Event ${suffix}`, `event ${suffix}`, status, organizer.profileId, startsAt],
  );
  const eventId = rows[0].id as string;
  await client.query(
    `insert into public.birth_giving_event_organizers
       (event_id, profile_id, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $2, $2)`,
    [eventId, organizer.profileId],
  );
  return eventId;
}

async function insertTeam(client: PoolClient, eventId: string, actorId: string, name = "Team"): Promise<string> {
  const { rows } = await client.query(
    `insert into public.birth_giving_teams
       (event_id, name, status, result_state, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, 'confirmed', 'present', $3, $3)
     returning id`,
    [eventId, name, actorId],
  );
  return rows[0].id as string;
}

async function insertMembership(
  client: PoolClient,
  eventId: string,
  teamId: string,
  profileId: string,
  actorId: string,
): Promise<void> {
  await client.query(
    `insert into public.birth_giving_team_members
       (event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, $4, $4)`,
    [eventId, teamId, profileId, actorId],
  );
}

describe("Birth Giving relational schema", () => {
  it("defines all validated enums and enables RLS on every BG table", async () => {
    await withRollback(async (client) => {
      const { rows: enumRows } = await client.query<{ typname: string }>(
        `select typname from pg_type
          where typname like 'birth_giving_%'
            and typtype = 'e'`,
      );
      expect(enumRows.map((row) => row.typname).sort()).toEqual([
        "birth_giving_assignment_state",
        "birth_giving_delivery_status",
        "birth_giving_duration",
        "birth_giving_email_message_type",
        "birth_giving_event_status",
        "birth_giving_proposal_direction",
        "birth_giving_proposal_state",
        "birth_giving_team_result_state",
        "birth_giving_team_status",
      ]);

      const { rows: tableRows } = await client.query<{ relname: string; relrowsecurity: boolean }>(
        `select c.relname, c.relrowsecurity
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relkind = 'r'
            and c.relname like 'birth_giving_%'`,
      );
      expect(tableRows).toHaveLength(10);
      expect(tableRows.every((row) => row.relrowsecurity)).toBe(true);
    });
  });

  it("rejects an exact duplicate event identity", async () => {
    await withRollback(async (client) => {
      const { organizer } = await seedActors(client);
      await insertEvent(client, organizer);
      await expect(insertEvent(client, organizer)).rejects.toThrow(/unique|duplicate/i);
    });
  });

  it("rejects identity normalization values that do not match event text", async () => {
    await withRollback(async (client) => {
      const { organizer } = await seedActors(client);
      await expect(
        client.query(
          `insert into public.birth_giving_events
             (name, normalized_name, customer, normalized_customer, starts_at, duration,
              minimum_team_size, maximum_team_size, joining_open, status,
              created_by_profile_id, updated_by_profile_id)
           values ('  Event   Name ', 'spoofed', ' CUSTOMER ', 'different',
                   '2026-09-01T08:00:00Z', '8h', 1, 4, true, 'draft', $1, $1)`,
          [organizer.profileId],
        ),
      ).rejects.toThrow(/check/i);
    });
  });

  it("rejects cross-event membership, proposal, result, and reflection relationships", async () => {
    await withRollback(async (client) => {
      const { organizer, member } = await seedActors(client);
      const firstEventId = await insertEvent(client, organizer, "published", "first");
      const secondEventId = await insertEvent(client, organizer, "published", "second");
      const firstTeamId = await insertTeam(client, firstEventId, organizer.profileId);
      const secondTeamId = await insertTeam(client, secondEventId, organizer.profileId);
      await insertMembership(client, firstEventId, firstTeamId, member.profileId, organizer.profileId);

      await expectConstraintViolation(
        client,
        () => insertMembership(client, secondEventId, firstTeamId, organizer.profileId, organizer.profileId),
        /foreign key/i,
      );
      await expectConstraintViolation(
        client,
        () => client.query(
          `insert into public.birth_giving_team_proposals
             (event_id, team_id, candidate_profile_id, initiated_by_profile_id, direction,
              created_by_profile_id, updated_by_profile_id)
           values ($1, $2, $3, $3, 'join_request', $3, $3)`,
          [secondEventId, firstTeamId, member.profileId],
        ),
        /foreign key/i,
      );
      await expectConstraintViolation(
        client,
        () => client.query(
          `insert into public.birth_giving_team_result_files
             (event_id, team_id, storage_path, original_file_name, mime_type, file_size,
              uploaded_by_profile_id, created_by_profile_id, updated_by_profile_id)
           values ($1, $2, 'bg/result.pdf', 'result.pdf', 'application/pdf', 12, $3, $3, $3)`,
          [secondEventId, firstTeamId, organizer.profileId],
        ),
        /foreign key/i,
      );
      await expectConstraintViolation(
        client,
        () => client.query(
          `insert into public.birth_giving_reflections
             (event_id, profile_id, contribution, learning, created_by_profile_id, updated_by_profile_id)
           values ($1, $2, 'Contribution', 'Learning', $2, $2)`,
          [secondEventId, member.profileId],
        ),
        /foreign key/i,
      );

      expect(secondTeamId).not.toBe(firstTeamId);
    });
  });

  it("allows only one confirmed membership per profile and event", async () => {
    await withRollback(async (client) => {
      const { organizer, member } = await seedActors(client);
      const eventId = await insertEvent(client, organizer);
      const firstTeamId = await insertTeam(client, eventId, organizer.profileId, "One");
      const secondTeamId = await insertTeam(client, eventId, organizer.profileId, "Two");
      await insertMembership(client, eventId, firstTeamId, member.profileId, organizer.profileId);
      await expect(
        insertMembership(client, eventId, secondTeamId, member.profileId, organizer.profileId),
      ).rejects.toThrow(/unique|duplicate/i);
    });
  });

  it("allows one reflection only for a confirmed participant", async () => {
    await withRollback(async (client) => {
      const { organizer, member, other } = await seedActors(client);
      const eventId = await insertEvent(client, organizer);
      const teamId = await insertTeam(client, eventId, organizer.profileId);
      await insertMembership(client, eventId, teamId, member.profileId, organizer.profileId);
      const insertReflection = (profileId: string) => client.query(
        `insert into public.birth_giving_reflections
           (event_id, profile_id, contribution, learning, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, 'Contribution', 'Learning', $2, $2)`,
        [eventId, profileId],
      );
      await insertReflection(member.profileId);
      await expectConstraintViolation(client, () => insertReflection(member.profileId), /unique|duplicate/i);
      await expectConstraintViolation(client, () => insertReflection(other.profileId), /foreign key/i);
    });
  });

  it("deduplicates release deliveries and individual assignment replacements", async () => {
    await withRollback(async (client) => {
      const { organizer, member } = await seedActors(client);
      const eventId = await insertEvent(client, organizer);
      const teamId = await insertTeam(client, eventId, organizer.profileId);
      await insertMembership(client, eventId, teamId, member.profileId, organizer.profileId);
      const replacementId = "9bb6f974-eb20-44e6-aeb4-29e621df911b";
      const insertDelivery = (messageType: "assignment_release" | "assignment_replacement", id: string | null) =>
        client.query(
          `insert into public.birth_giving_email_deliveries
             (event_id, profile_id, message_type, replacement_id, recipient_email,
              created_by_profile_id, updated_by_profile_id)
           values ($1, $2, $3, $4, 'member@example.com', $5, $5)`,
          [eventId, member.profileId, messageType, id, organizer.profileId],
      );
      await insertDelivery("assignment_release", null);
      await expectConstraintViolation(client, () => insertDelivery("assignment_release", null), /unique|duplicate/i);
      await insertDelivery("assignment_replacement", replacementId);
      await expectConstraintViolation(client, () => insertDelivery("assignment_replacement", replacementId), /unique|duplicate/i);
      await expectConstraintViolation(client, () => insertDelivery("assignment_replacement", null), /check/i);
    });
  });

  it("rejects delivery rows for profiles without confirmed event membership", async () => {
    await withRollback(async (client) => {
      const { organizer, other } = await seedActors(client);
      const eventId = await insertEvent(client, organizer);
      await expect(
        client.query(
          `insert into public.birth_giving_email_deliveries
             (event_id, profile_id, message_type, recipient_email,
              created_by_profile_id, updated_by_profile_id)
           values ($1, $2, 'assignment_release', 'other@example.com', $3, $3)`,
          [eventId, other.profileId, organizer.profileId],
        ),
      ).rejects.toThrow(/foreign key/i);
    });
  });
});

describe("Birth Giving RLS", () => {
  it("shows drafts only to named organizers and published events to verified community", async () => {
    await withRollback(async (client) => {
      const { organizer, other } = await seedActors(client);
      const draftId = await insertEvent(client, organizer, "draft", "draft");
      const publishedId = await insertEvent(client, organizer, "published", "published");

      await asClaims(client, { sub: other.authUserId });
      const { rows: communityRows } = await client.query("select id from public.birth_giving_events order by id");
      expect(communityRows.map((row) => row.id)).toEqual([publishedId]);

      await asClaims(client, { sub: organizer.authUserId });
      const { rows: organizerRows } = await client.query("select id from public.birth_giving_events");
      expect(organizerRows.map((row) => row.id).sort()).toEqual([draftId, publishedId].sort());
    });
  });

  it("denies direct event creation and mutation, including publication", async () => {
    await withRollback(async (client) => {
      const { organizer, other } = await seedActors(client);
      const eventId = await insertEvent(client, organizer, "draft");

      await asClaims(client, { sub: other.authUserId });
      const denied = await client.query(
        "update public.birth_giving_events set customer = 'Denied' where id = $1",
        [eventId],
      );
      expect(denied.rowCount).toBe(0);

      await asClaims(client, { sub: organizer.authUserId });
      const publication = await client.query(
        "update public.birth_giving_events set status = 'published', updated_by_profile_id = $2 where id = $1",
        [eventId, organizer.profileId],
      );
      expect(publication.rowCount).toBe(0);
      await expect(
        client.query(
          `insert into public.birth_giving_events
             (name, normalized_name, customer, normalized_customer, starts_at, duration,
              minimum_team_size, maximum_team_size, joining_open, status,
              created_by_profile_id, updated_by_profile_id)
           values ('Direct', 'direct', 'Customer', 'customer', '2026-10-01T08:00:00Z',
                   '8h', 1, 4, true, 'draft', $1, $1)`,
          [organizer.profileId],
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("denies all direct assignment mutations", async () => {
    await withRollback(async (client) => {
      const { organizer } = await seedActors(client);
      const eventId = await insertEvent(client, organizer);

      await asClaims(client, { sub: organizer.authUserId });
      await expectConstraintViolation(
        client,
        () => client.query(
          `insert into public.birth_giving_assignments
             (event_id, state, created_by_profile_id, updated_by_profile_id)
           values ($1, 'missing', $2, $2)`,
          [eventId, organizer.profileId],
        ),
        /row-level security/i,
      );

      await client.query("reset role");
      await client.query(
        `insert into public.birth_giving_assignments
           (event_id, state, created_by_profile_id, updated_by_profile_id)
         values ($1, 'missing', $2, $2)`,
        [eventId, organizer.profileId],
      );
      await asClaims(client, { sub: organizer.authUserId });
      const update = await client.query(
        "update public.birth_giving_assignments set replacement_id = gen_random_uuid() where event_id = $1",
        [eventId],
      );
      expect(update.rowCount).toBe(0);
      const deletion = await client.query(
        "delete from public.birth_giving_assignments where event_id = $1",
        [eventId],
      );
      expect(deletion.rowCount).toBe(0);
    });
  });

  it("denies published event reads after the caller profile is revoked", async () => {
    await withRollback(async (client) => {
      const { organizer, other } = await seedActors(client);
      const eventId = await insertEvent(client, organizer);
      await client.query("alter table public.profiles disable trigger enforce_picture_only_update");
      await client.query(
        "update public.profiles set access_removed_at = now(), access_removed_by_profile_id = $2 where id = $1",
        [other.profileId, organizer.profileId],
      );
      await client.query("alter table public.profiles enable trigger enforce_picture_only_update");

      await asClaims(client, { sub: other.authUserId });
      const { rows } = await client.query(
        "select id from public.birth_giving_events where id = $1",
        [eventId],
      );
      expect(rows).toEqual([]);
    });
  });

  it("shows all organizer rows to co-organizers and published-event community", async () => {
    await withRollback(async (client) => {
      const { organizer, member, other } = await seedActors(client);
      const eventId = await insertEvent(client, organizer);
      await client.query(
        `insert into public.birth_giving_event_organizers
           (event_id, profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $3, $3)`,
        [eventId, member.profileId, organizer.profileId],
      );

      for (const actor of [organizer, member, other]) {
        await asClaims(client, { sub: actor.authUserId });
        const { rows } = await client.query(
          "select profile_id from public.birth_giving_event_organizers where event_id = $1 order by profile_id",
          [eventId],
        );
        expect(rows.map((row) => row.profile_id)).toEqual(
          [organizer.profileId, member.profileId].sort(),
        );
      }
    });
  });

  it("allows members to add results and organizers only for historical events", async () => {
    await withRollback(async (client) => {
      const { organizer, member, other } = await seedActors(client);
      const eventId = await insertEvent(client, organizer);
      const teamId = await insertTeam(client, eventId, organizer.profileId);
      await insertMembership(client, eventId, teamId, member.profileId, organizer.profileId);
      const insertResult = (actor: Actor, name: string) => client.query(
        `insert into public.birth_giving_team_result_files
           (event_id, team_id, storage_path, original_file_name, mime_type, file_size,
            uploaded_by_profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $3, $4, 'application/pdf', 12, $5, $5, $5)`,
        [eventId, teamId, `bg/${name}.pdf`, `${name}.pdf`, actor.profileId],
      );

      await asClaims(client, { sub: member.authUserId });
      await expect(insertResult(member, "member")).resolves.toBeDefined();
      await asClaims(client, { sub: organizer.authUserId });
      await expectConstraintViolation(
        client,
        () => insertResult(organizer, "future-organizer"),
        /row-level security/i,
      );
      await asClaims(client, { sub: other.authUserId });
      await expectConstraintViolation(client, () => insertResult(other, "other"), /row-level security/i);

      await client.query("reset role");
      const historicalEventId = await insertEvent(
        client,
        organizer,
        "published",
        "historical",
        "2026-07-01T08:00:00Z",
      );
      const historicalTeamId = await insertTeam(client, historicalEventId, organizer.profileId, "Historical");
      await asClaims(client, { sub: organizer.authUserId });
      await expect(
        client.query(
          `insert into public.birth_giving_team_result_files
             (event_id, team_id, storage_path, original_file_name, mime_type, file_size,
              uploaded_by_profile_id, created_by_profile_id, updated_by_profile_id)
           values ($1, $2, 'bg/historical.pdf', 'historical.pdf', 'application/pdf', 12, $3, $3, $3)`,
          [historicalEventId, historicalTeamId, organizer.profileId],
        ),
      ).resolves.toBeDefined();
    });
  });

  it("allows only the participant to create and edit their reflection, while community can read it", async () => {
    await withRollback(async (client) => {
      const { organizer, member, other } = await seedActors(client);
      const eventId = await insertEvent(client, organizer);
      const teamId = await insertTeam(client, eventId, organizer.profileId);
      await insertMembership(client, eventId, teamId, member.profileId, organizer.profileId);

      await asClaims(client, { sub: member.authUserId });
      const { rows } = await client.query(
        `insert into public.birth_giving_reflections
           (event_id, profile_id, contribution, learning, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, 'Contribution', 'Learning', $2, $2)
         returning id`,
        [eventId, member.profileId],
      );

      await asClaims(client, { sub: other.authUserId });
      const { rows: visibleRows } = await client.query(
        "select contribution from public.birth_giving_reflections where id = $1",
        [rows[0].id],
      );
      expect(visibleRows[0].contribution).toBe("Contribution");
      const denied = await client.query(
        "update public.birth_giving_reflections set contribution = 'Changed' where id = $1",
        [rows[0].id],
      );
      expect(denied.rowCount).toBe(0);

      await asClaims(client, { sub: member.authUserId });
      const allowed = await client.query(
        "update public.birth_giving_reflections set contribution = 'Changed', updated_by_profile_id = $2 where id = $1",
        [rows[0].id, member.profileId],
      );
      expect(allowed.rowCount).toBe(1);
    });
  });
});
