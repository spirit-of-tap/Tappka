import type { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import { insertVerifiedProfile } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

const HOUR_MS = 60 * 60 * 1_000;
const MIB = 1024 * 1024;

interface Actor { authUserId: string; profileId: string }

async function expectDatabaseError(
  client: PoolClient,
  operation: () => Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  await client.query("savepoint expected_storage_error");
  try {
    await operation();
    throw new Error("Expected database error");
  } catch (error: unknown) {
    await client.query("rollback to savepoint expected_storage_error");
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(pattern);
  } finally {
    await client.query("release savepoint expected_storage_error");
  }
}

async function seedEvent(
  client: PoolClient,
  organizer: Actor,
  member: Actor,
  startsAt: string,
  status: "draft" | "published" = "published",
): Promise<{ eventId: string; teamId: string }> {
  await client.query("reset role");
  const eventId = crypto.randomUUID();
  const teamId = crypto.randomUUID();
  await client.query(
    `insert into public.birth_giving_events
      (id, name, normalized_name, customer, normalized_customer, starts_at, duration,
       minimum_team_size, maximum_team_size, joining_open, status, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, lower($2), 'Customer', 'customer', $3, '8h', 1, 4, false, $4, $5, $5)`,
    [eventId, `Storage ${eventId}`, startsAt, status, organizer.profileId],
  );
  await client.query(
    `insert into public.birth_giving_event_organizers
       (event_id, profile_id, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $2, $2)`,
    [eventId, organizer.profileId],
  );
  await client.query(
    `insert into public.birth_giving_teams
       (id, event_id, name, status, result_state, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, 'Team', 'confirmed', 'pending', $3, $3)`,
    [teamId, eventId, organizer.profileId],
  );
  await client.query(
    `insert into public.birth_giving_team_members
       (event_id, team_id, profile_id, frozen_at, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, case when $4 = 'published' then now() else null end, $3, $3)`,
    [eventId, teamId, member.profileId, status],
  );
  await asClaims(client, { sub: organizer.authUserId });
  return { eventId, teamId };
}

describe("Birth Giving storage RPCs", () => {
  it("switches assignment metadata before returning the old path and queues active replacement mail", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId } = await seedEvent(client, organizer, member, new Date(Date.now() - HOUR_MS).toISOString());

      const first = await client.query<{ old_storage_path: string | null }>(
        "select public.birth_giving_confirm_assignment($1, $2, $3, $4, $5) as old_storage_path",
        [eventId, `birth-giving/assignments/${eventId}/first.pdf`, "first.pdf", "application/pdf", 1_000],
      );
      expect(first.rows[0].old_storage_path).toBeNull();
      const second = await client.query<{ old_storage_path: string | null }>(
        "select public.birth_giving_confirm_assignment($1, $2, $3, $4, $5) as old_storage_path",
        [eventId, `birth-giving/assignments/${eventId}/second.pdf`, "second.pdf", "application/pdf", 2_000],
      );
      expect(second.rows[0].old_storage_path).toBe(`birth-giving/assignments/${eventId}/first.pdf`);

      const assignment = await client.query("select * from public.birth_giving_assignments where event_id = $1", [eventId]);
      expect(assignment.rows[0]).toMatchObject({
        state: "present",
        storage_path: `birth-giving/assignments/${eventId}/second.pdf`,
        updated_by_profile_id: organizer.profileId,
      });
      await client.query("reset role");
      const outbox = await client.query(
        "select profile_id, message_type, replacement_id from public.birth_giving_email_deliveries where event_id = $1",
        [eventId],
      );
      expect(outbox.rows).toEqual([
        expect.objectContaining({ profile_id: member.profileId, message_type: "assignment_replacement" }),
      ]);
      expect(outbox.rows[0].replacement_id).toBe(assignment.rows[0].replacement_id);
    });
  });

  it("rejects assignment mutation by non-organizers and after the event ends", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const other = await insertVerifiedProfile(client, { name: "Other" });
      const { eventId } = await seedEvent(client, organizer, member, new Date(Date.now() - 9 * HOUR_MS).toISOString());
      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_confirm_assignment($1, $2, 'x.pdf', 'application/pdf', 1)",
          [eventId, `birth-giving/assignments/${eventId}/x.pdf`],
        ),
        /locked|ended/i,
      );
      await asClaims(client, { sub: other.authUserId });
      await expect(client.query("select public.birth_giving_mark_assignment_missing($1)", [eventId]))
        .rejects.toThrow(/organizer|authorized/i);
    });
  });

  it("marks a historical assignment missing and clears all file metadata with caller audit", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId } = await seedEvent(client, organizer, member, new Date(Date.now() - 9 * HOUR_MS).toISOString(), "draft");
      await client.query(
        "select public.birth_giving_confirm_assignment($1, $2, 'old.pdf', 'application/pdf', 100)",
        [eventId, `birth-giving/assignments/${eventId}/old.pdf`],
      );
      const { rows } = await client.query<{ birth_giving_mark_assignment_missing: string }>(
        "select public.birth_giving_mark_assignment_missing($1)", [eventId],
      );
      expect(rows[0].birth_giving_mark_assignment_missing).toContain("old.pdf");
      const assignment = await client.query("select * from public.birth_giving_assignments where event_id = $1", [eventId]);
      expect(assignment.rows[0]).toMatchObject({ state: "missing", storage_path: null, updated_by_profile_id: organizer.profileId });
    });
  });

  it("supports multiple active result files and enforces the cumulative 100 MiB limit", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId, teamId } = await seedEvent(client, organizer, member, new Date(Date.now() - 9 * HOUR_MS).toISOString());
      await asClaims(client, { sub: member.authUserId });
      for (const name of ["one", "two", "three", "four"]) {
        await client.query(
          "select public.birth_giving_confirm_result_file($1, $2, $3, $4, 'application/pdf', $5)",
          [eventId, teamId, `birth-giving/results/${eventId}/${teamId}/${name}.pdf`, `${name}.pdf`, 25 * MIB],
        );
      }
      await expectDatabaseError(
        client,
        () => client.query("select public.birth_giving_confirm_result_file($1, $2, $3, 'five.pdf', 'application/pdf', 1)", [eventId, teamId, `birth-giving/results/${eventId}/${teamId}/five.pdf`]),
        /100 MiB|storage limit/i,
      );
      const files = await client.query("select * from public.birth_giving_team_result_files where team_id = $1 and removed_at is null", [teamId]);
      expect(files.rows).toHaveLength(4);
      expect(files.rows.every((row) => row.created_by_profile_id === member.profileId)).toBe(true);
    });
  });

  it("soft-removes results, restores pending symmetry, and marks all results missing atomically", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId, teamId } = await seedEvent(client, organizer, member, new Date(Date.now() - 9 * HOUR_MS).toISOString());
      await asClaims(client, { sub: member.authUserId });
      const inserted = await client.query<{ birth_giving_confirm_result_file: string }>(
        "select public.birth_giving_confirm_result_file($1, $2, $3, 'one.pdf', 'application/pdf', 10)",
        [eventId, teamId, `birth-giving/results/${eventId}/${teamId}/one.pdf`],
      );
      const removed = await client.query<{ birth_giving_remove_result_file: string }>(
        "select public.birth_giving_remove_result_file($1)", [inserted.rows[0].birth_giving_confirm_result_file],
      );
      expect(removed.rows[0].birth_giving_remove_result_file).toContain("one.pdf");
      expect((await client.query("select result_state from public.birth_giving_teams where id = $1", [teamId])).rows[0].result_state).toBe("pending");

      await client.query("select public.birth_giving_confirm_result_file($1, $2, $3, 'two.pdf', 'application/pdf', 10)", [eventId, teamId, `birth-giving/results/${eventId}/${teamId}/two.pdf`]);
      const missing = await client.query<{ birth_giving_mark_result_missing: string[] }>(
        "select public.birth_giving_mark_result_missing($1, $2)", [eventId, teamId],
      );
      expect(missing.rows[0].birth_giving_mark_result_missing).toEqual([`birth-giving/results/${eventId}/${teamId}/two.pdf`]);
      expect((await client.query("select result_state from public.birth_giving_teams where id = $1", [teamId])).rows[0].result_state).toBe("missing");
      expect((await client.query("select count(*)::int as count from public.birth_giving_team_result_files where team_id = $1 and removed_at is null", [teamId])).rows[0].count).toBe(0);
    });
  });

  it("rejects cross-event result linkage and unauthorized result management", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const other = await insertVerifiedProfile(client, { name: "Other" });
      const first = await seedEvent(client, organizer, member, new Date(Date.now() - 9 * HOUR_MS).toISOString());
      const second = await seedEvent(client, organizer, member, new Date(Date.now() - 9 * HOUR_MS).toISOString());
      await expectDatabaseError(
        client,
        () => client.query(
          "select public.birth_giving_confirm_result_file($1, $2, $3, 'x.pdf', 'application/pdf', 1)",
          [first.eventId, second.teamId, `birth-giving/results/${first.eventId}/${second.teamId}/x.pdf`],
        ),
        /belong|relation/i,
      );
      await asClaims(client, { sub: other.authUserId });
      await expect(client.query("select public.birth_giving_mark_result_missing($1, $2)", [first.eventId, first.teamId]))
        .rejects.toThrow(/member|organizer|authorized/i);
    });
  });
});
