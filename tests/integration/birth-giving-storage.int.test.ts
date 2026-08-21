import type { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import { insertVerifiedProfile } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import { getPool } from "@/tests/setup/testdb";
import { withRollback } from "@/tests/setup/tx";

const HOUR_MS = 60 * 60 * 1_000;
const LOCK_WAIT_POLL_MS = 10;
const LOCK_WAIT_TIMEOUT_MS = 5_000;
const MIB = 1024 * 1024;
const RACE_STATEMENT_TIMEOUT_MS = 3_000;

interface Actor { authUserId: string; profileId: string }

async function insertStoredObject(
  client: PoolClient,
  storagePath: string,
  mimeType = "application/pdf",
  fileSize = 1_000,
  createdAt?: string,
): Promise<void> {
  await client.query("reset role");
  await client.query(
    `insert into storage.objects (bucket_id, name, metadata, created_at)
     values ('documents', $1, jsonb_build_object('size', $2::bigint, 'mimetype', $3::text), coalesce($4::timestamptz, now()))`,
    [storagePath, fileSize, mimeType, createdAt ?? null],
  );
}

async function asServiceRole(client: PoolClient): Promise<void> {
  await client.query("reset role");
  await client.query("set local role service_role");
}

async function confirmAssignment(
  client: PoolClient,
  actorProfileId: string,
  eventId: string,
  storagePath: string,
  originalFileName: string,
  mimeType: string,
  fileSize: number,
): Promise<string | null> {
  await asServiceRole(client);
  const result = await client.query<{ value: string | null }>(
    "select public.birth_giving_confirm_assignment($1, $2, $3, $4, $5, $6) as value",
    [actorProfileId, eventId, storagePath, originalFileName, mimeType, fileSize],
  );
  return result.rows[0].value;
}

async function confirmResultFile(
  client: PoolClient,
  actorProfileId: string,
  eventId: string,
  teamId: string,
  storagePath: string,
  originalFileName: string,
  mimeType: string,
  fileSize: number,
): Promise<string> {
  await asServiceRole(client);
  const result = await client.query<{ value: string }>(
    "select public.birth_giving_confirm_result_file($1, $2, $3, $4, $5, $6, $7) as value",
    [actorProfileId, eventId, teamId, storagePath, originalFileName, mimeType, fileSize],
  );
  return result.rows[0].value;
}

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

async function waitForBlockedConnection(applicationName: string): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { rows } = await getPool().query<{ blocked: boolean }>(
      `select exists (
         select 1 from pg_stat_activity
         where application_name = $1 and wait_event_type = 'Lock'
       ) as blocked`,
      [applicationName],
    );
    if (rows[0].blocked) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_POLL_MS));
  }
  throw new Error(`Connection did not block: ${applicationName}`);
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
  it("queues release mail for the first active assignment and replacement mail for later versions", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId } = await seedEvent(client, organizer, member, new Date(Date.now() - HOUR_MS).toISOString());
      const firstPath = `birth-giving/assignments/${eventId}/first.pdf`;
      const secondPath = `birth-giving/assignments/${eventId}/second.pdf`;
      await insertStoredObject(client, firstPath);
      await insertStoredObject(client, secondPath, "application/pdf", 2_000);
      await asClaims(client, { sub: organizer.authUserId });

      expect(await confirmAssignment(client, organizer.profileId, eventId, firstPath, "first.pdf", "application/pdf", 1_000)).toBeNull();
      expect(await confirmAssignment(client, organizer.profileId, eventId, secondPath, "second.pdf", "application/pdf", 2_000)).toBe(firstPath);

      const assignment = await client.query("select * from public.birth_giving_assignments where event_id = $1", [eventId]);
      expect(assignment.rows[0]).toMatchObject({
        state: "present",
        storage_path: `birth-giving/assignments/${eventId}/second.pdf`,
        updated_by_profile_id: organizer.profileId,
      });
      await client.query("reset role");
      const outbox = await client.query(
        `select profile_id, message_type, replacement_id
           from public.birth_giving_email_deliveries
          where event_id = $1
          order by message_type`,
        [eventId],
      );
      expect(outbox.rows).toEqual([
        expect.objectContaining({
          profile_id: member.profileId,
          message_type: "assignment_release",
          replacement_id: null,
        }),
        expect.objectContaining({
          profile_id: member.profileId,
          message_type: "assignment_replacement",
          replacement_id: assignment.rows[0].replacement_id,
        }),
      ]);
    });
  });

  it("treats a lost-response assignment confirmation retry as an idempotent replay", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId } = await seedEvent(client, organizer, member, new Date(Date.now() - HOUR_MS).toISOString());
      const oldPath = `birth-giving/assignments/${eventId}/old.pdf`;
      const retryPath = `birth-giving/assignments/${eventId}/retry.pdf`;
      await insertStoredObject(client, oldPath);
      await insertStoredObject(client, retryPath, "application/pdf", 2_000);
      await asClaims(client, { sub: organizer.authUserId });
      await confirmAssignment(client, organizer.profileId, eventId, oldPath, "old.pdf", "application/pdf", 1_000);
      const first = await confirmAssignment(client, organizer.profileId, eventId, retryPath, "retry.pdf", "application/pdf", 2_000);
      const beforeRetry = await client.query<{ replacement_id: string }>(
        "select replacement_id from public.birth_giving_assignments where event_id = $1",
        [eventId],
      );
      const deliveriesBefore = await client.query<{ count: number }>(
        "select count(*)::int as count from public.birth_giving_email_deliveries where event_id = $1",
        [eventId],
      );

      const retry = await confirmAssignment(client, organizer.profileId, eventId, retryPath, "retry.pdf", "application/pdf", 2_000);
      const afterRetry = await client.query<{ replacement_id: string }>(
        "select replacement_id from public.birth_giving_assignments where event_id = $1",
        [eventId],
      );
      const deliveriesAfter = await client.query<{ count: number }>(
        "select count(*)::int as count from public.birth_giving_email_deliveries where event_id = $1",
        [eventId],
      );

      expect(first).toBe(oldPath);
      expect(retry).toBeNull();
      expect(afterRetry.rows[0].replacement_id).toBe(beforeRetry.rows[0].replacement_id);
      expect(deliveriesAfter.rows[0].count).toBe(deliveriesBefore.rows[0].count);
    });
  });

  it("rejects direct assignment confirmation for missing, mismatched, and unsafe storage objects", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId } = await seedEvent(client, organizer, member, new Date(Date.now() - HOUR_MS).toISOString());
      const missingPath = `birth-giving/assignments/${eventId}/missing.pdf`;
      await expectDatabaseError(
        client,
        () => confirmAssignment(client, organizer.profileId, eventId, missingPath, "missing.pdf", "application/pdf", 1_000),
        /storage object|metadata/i,
      );

      const mismatchPath = `birth-giving/assignments/${eventId}/mismatch.pdf`;
      await insertStoredObject(client, mismatchPath, "application/pdf", 999);
      await asClaims(client, { sub: organizer.authUserId });
      await expectDatabaseError(
        client,
        () => confirmAssignment(client, organizer.profileId, eventId, mismatchPath, "mismatch.pdf", "application/pdf", 1_000),
        /storage object|metadata/i,
      );

      const unsafePath = `birth-giving/assignments/${eventId}/payload.exe`;
      await insertStoredObject(client, unsafePath, "application/x-msdownload", 100);
      await asClaims(client, { sub: organizer.authUserId });
      await expectDatabaseError(
        client,
        () => confirmAssignment(client, organizer.profileId, eventId, unsafePath, "payload.exe", "application/x-msdownload", 100),
        /invalid assignment file metadata/i,
      );
    });
  });

  it("rejects assignment mutation by non-organizers and after the event ends", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const other = await insertVerifiedProfile(client, { name: "Other" });
      const { eventId } = await seedEvent(client, organizer, member, new Date(Date.now() - 9 * HOUR_MS).toISOString());
      const storagePath = `birth-giving/assignments/${eventId}/x.pdf`;
      await insertStoredObject(client, storagePath, "application/pdf", 1);
      await asClaims(client, { sub: organizer.authUserId });
      await expectDatabaseError(
        client,
        () => confirmAssignment(client, organizer.profileId, eventId, storagePath, "x.pdf", "application/pdf", 1),
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
      const oldPath = `birth-giving/assignments/${eventId}/old.pdf`;
      await insertStoredObject(client, oldPath, "application/pdf", 100);
      await asClaims(client, { sub: organizer.authUserId });
      await confirmAssignment(client, organizer.profileId, eventId, oldPath, "old.pdf", "application/pdf", 100);
      await asClaims(client, { sub: organizer.authUserId });
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
        const storagePath = `birth-giving/results/${eventId}/${teamId}/${name}.pdf`;
        await insertStoredObject(client, storagePath, "application/pdf", 25 * MIB);
        await asClaims(client, { sub: member.authUserId });
        await confirmResultFile(client, member.profileId, eventId, teamId, storagePath, `${name}.pdf`, "application/pdf", 25 * MIB);
      }
      const fifthPath = `birth-giving/results/${eventId}/${teamId}/five.pdf`;
      await insertStoredObject(client, fifthPath, "application/pdf", 1);
      await asClaims(client, { sub: member.authUserId });
      await expectDatabaseError(
        client,
        () => confirmResultFile(client, member.profileId, eventId, teamId, fifthPath, "five.pdf", "application/pdf", 1),
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
      const onePath = `birth-giving/results/${eventId}/${teamId}/one.pdf`;
      const twoPath = `birth-giving/results/${eventId}/${teamId}/two.pdf`;
      await insertStoredObject(client, onePath, "application/pdf", 10);
      await insertStoredObject(client, twoPath, "application/pdf", 10);
      await asClaims(client, { sub: member.authUserId });
      const insertedId = await confirmResultFile(client, member.profileId, eventId, teamId, onePath, "one.pdf", "application/pdf", 10);
      await asClaims(client, { sub: member.authUserId });
      const removed = await client.query<{ birth_giving_remove_result_file: string }>(
        "select public.birth_giving_remove_result_file($1)", [insertedId],
      );
      expect(removed.rows[0].birth_giving_remove_result_file).toContain("one.pdf");
      expect((await client.query("select result_state from public.birth_giving_teams where id = $1", [teamId])).rows[0].result_state).toBe("pending");

      await confirmResultFile(client, member.profileId, eventId, teamId, twoPath, "two.pdf", "application/pdf", 10);
      await asClaims(client, { sub: member.authUserId });
      const missing = await client.query<{ birth_giving_mark_result_missing: string[] }>(
        "select public.birth_giving_mark_result_missing($1, $2)", [eventId, teamId],
      );
      expect(missing.rows[0].birth_giving_mark_result_missing).toEqual([`birth-giving/results/${eventId}/${teamId}/two.pdf`]);
      expect((await client.query("select result_state from public.birth_giving_teams where id = $1", [teamId])).rows[0].result_state).toBe("missing");
      expect((await client.query("select count(*)::int as count from public.birth_giving_team_result_files where team_id = $1 and removed_at is null", [teamId])).rows[0].count).toBe(0);
    });
  });

  it("rejects direct result confirmation when the object metadata or format is unsafe", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId, teamId } = await seedEvent(client, organizer, member, new Date(Date.now() - 9 * HOUR_MS).toISOString());
      await asClaims(client, { sub: member.authUserId });
      const missingPath = `birth-giving/results/${eventId}/${teamId}/missing.pdf`;
      await expectDatabaseError(
        client,
        () => confirmResultFile(client, member.profileId, eventId, teamId, missingPath, "missing.pdf", "application/pdf", 10),
        /storage object|metadata/i,
      );
      const unsafePath = `birth-giving/results/${eventId}/${teamId}/unsafe.svg`;
      await insertStoredObject(client, unsafePath, "image/svg+xml", 10);
      await asClaims(client, { sub: member.authUserId });
      await expectDatabaseError(
        client,
        () => confirmResultFile(client, member.profileId, eventId, teamId, unsafePath, "unsafe.svg", "image/svg+xml", 10),
        /invalid result file metadata/i,
      );
    });
  });

  it("allows an organizer to upload a stored result for a historical event", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId, teamId } = await seedEvent(client, organizer, member, new Date(Date.now() - 9 * HOUR_MS).toISOString());
      const storagePath = `birth-giving/results/${eventId}/${teamId}/organizer.pdf`;
      await insertStoredObject(client, storagePath, "application/pdf", 10);
      await asClaims(client, { sub: organizer.authUserId });

      const resultId = await confirmResultFile(client, organizer.profileId, eventId, teamId, storagePath, "organizer.pdf", "application/pdf", 10);

      expect(resultId).toBeTypeOf("string");
    });
  });

  it("rejects cross-event result linkage and unauthorized result management", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const other = await insertVerifiedProfile(client, { name: "Other" });
      const first = await seedEvent(client, organizer, member, new Date(Date.now() - 9 * HOUR_MS).toISOString());
      const second = await seedEvent(client, organizer, member, new Date(Date.now() - 9 * HOUR_MS).toISOString());
      const storagePath = `birth-giving/results/${first.eventId}/${second.teamId}/x.pdf`;
      await insertStoredObject(client, storagePath, "application/pdf", 1);
      await asClaims(client, { sub: organizer.authUserId });
      await expectDatabaseError(
        client,
        () => confirmResultFile(client, organizer.profileId, first.eventId, second.teamId, storagePath, "x.pdf", "application/pdf", 1),
        /belong|relation/i,
      );
      await asClaims(client, { sub: other.authUserId });
      await expect(client.query("select public.birth_giving_mark_result_missing($1, $2)", [first.eventId, first.teamId]))
        .rejects.toThrow(/member|organizer|authorized/i);
    });
  });

  it("does not expose privileged storage RPCs to authenticated clients", async () => {
    await withRollback(async (client) => {
      const privileges = await client.query<{
        assignment: boolean;
        claim: boolean;
        finalize: boolean;
        release: boolean;
        result: boolean;
      }>(
        `select
          has_function_privilege('authenticated', 'public.birth_giving_confirm_assignment(uuid,uuid,text,text,text,bigint)', 'EXECUTE') as assignment,
          has_function_privilege('authenticated', 'public.birth_giving_confirm_result_file(uuid,uuid,uuid,text,text,text,bigint)', 'EXECUTE') as result,
          has_function_privilege('authenticated', 'public.birth_giving_claim_storage_cleanup(interval,integer)', 'EXECUTE') as claim,
          has_function_privilege('authenticated', 'public.birth_giving_finalize_storage_cleanup(text,uuid)', 'EXECUTE') as finalize,
          has_function_privilege('authenticated', 'public.birth_giving_release_storage_cleanup_claim(text,uuid)', 'EXECUTE') as release`,
      );
      expect(privileges.rows[0]).toEqual({
        assignment: false,
        claim: false,
        finalize: false,
        release: false,
        result: false,
      });
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId } = await seedEvent(client, organizer, member, new Date().toISOString(), "draft");
      const storagePath = `birth-giving/assignments/${eventId}/private.pdf`;
      await insertStoredObject(client, storagePath);
      await asClaims(client, { sub: organizer.authUserId });

      await expect(client.query(
        "select public.birth_giving_confirm_assignment($1::uuid, $2::uuid, $3::text, 'private.pdf'::text, 'application/pdf'::text, 1000::bigint)",
        [organizer.profileId, eventId, storagePath],
      )).rejects.toThrow(/permission denied/i);
    });
  });

  it("returns the existing result file on exact active-path replay without charging quota twice", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId, teamId } = await seedEvent(client, organizer, member, new Date(Date.now() - 9 * HOUR_MS).toISOString());
      const replayPath = `birth-giving/results/${eventId}/${teamId}/replay.pdf`;
      await insertStoredObject(client, replayPath, "application/pdf", 25 * MIB);
      for (const name of ["two", "three", "four"]) {
        await insertStoredObject(client, `birth-giving/results/${eventId}/${teamId}/${name}.pdf`, "application/pdf", 25 * MIB);
      }
      const firstId = await confirmResultFile(client, member.profileId, eventId, teamId, replayPath, "replay.pdf", "application/pdf", 25 * MIB);
      for (const name of ["two", "three", "four"]) {
        await confirmResultFile(client, member.profileId, eventId, teamId, `birth-giving/results/${eventId}/${teamId}/${name}.pdf`, `${name}.pdf`, "application/pdf", 25 * MIB);
      }

      const retryId = await confirmResultFile(client, member.profileId, eventId, teamId, replayPath, "replay.pdf", "application/pdf", 25 * MIB);
      expect(retryId).toBe(firstId);
      const files = await client.query<{ count: number }>(
        "select count(*)::int as count from public.birth_giving_team_result_files where team_id = $1 and removed_at is null",
        [teamId],
      );
      expect(files.rows[0].count).toBe(4);
    });
  });

  it("selects only aged unreferenced BG objects and rechecks references at cleanup time", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId, teamId } = await seedEvent(client, organizer, member, new Date(Date.now() - HOUR_MS).toISOString());
      const agedAt = new Date(Date.now() - 2 * HOUR_MS).toISOString();
      const orphanPath = `birth-giving/assignments/${eventId}/orphan.pdf`;
      const newlyReferencedPath = `birth-giving/assignments/${eventId}/current.pdf`;
      const resultPath = `birth-giving/results/${eventId}/${teamId}/current.pdf`;
      const recentPath = `birth-giving/assignments/${eventId}/recent.pdf`;
      await insertStoredObject(client, orphanPath, "application/pdf", 1_000, agedAt);
      await insertStoredObject(client, newlyReferencedPath, "application/pdf", 1_000, agedAt);
      await insertStoredObject(client, resultPath, "application/pdf", 1_000, agedAt);
      await insertStoredObject(client, recentPath);
      await confirmAssignment(client, organizer.profileId, eventId, newlyReferencedPath, "current.pdf", "application/pdf", 1_000);
      await confirmResultFile(client, member.profileId, eventId, teamId, resultPath, "current.pdf", "application/pdf", 1_000);

      await asServiceRole(client);
      const cleanup = await client.query<{ storage_path: string }>(
        "select storage_path from public.birth_giving_claim_storage_cleanup(interval '1 hour', 1)",
      );
      expect(cleanup.rows.map(({ storage_path: path }) => path)).toContain(orphanPath);
      expect(cleanup.rows.map(({ storage_path: path }) => path)).not.toContain(newlyReferencedPath);
      expect(cleanup.rows.map(({ storage_path: path }) => path)).not.toContain(resultPath);
      expect(cleanup.rows.map(({ storage_path: path }) => path)).not.toContain(recentPath);
    });
  });

  it("prevents confirmation while a storage cleanup claim is active", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const { eventId } = await seedEvent(client, organizer, member, new Date(Date.now() - HOUR_MS).toISOString());
      const storagePath = `birth-giving/assignments/${eventId}/claimed.pdf`;
      await insertStoredObject(client, storagePath, "application/pdf", 1_000, new Date(Date.now() - 2 * HOUR_MS).toISOString());
      await asServiceRole(client);

      const claims = await client.query<{ claim_id: string; storage_path: string }>(
        "select * from public.birth_giving_claim_storage_cleanup(interval '1 hour', 10)",
      );
      expect(claims.rows).toEqual([expect.objectContaining({ storage_path: storagePath })]);
      await expectDatabaseError(
        client,
        () => confirmAssignment(client, organizer.profileId, eventId, storagePath, "claimed.pdf", "application/pdf", 1_000),
        /cleanup|claimed/i,
      );
    });
  });

  it("keeps aged cleanup claims exclusive until their token releases or finalizes them", async () => {
    await withRollback(async (client) => {
      const storagePath = `birth-giving/assignments/${crypto.randomUUID()}/orphan.pdf`;
      await insertStoredObject(client, storagePath, "application/pdf", 1_000, new Date(Date.now() - 2 * HOUR_MS).toISOString());
      await asServiceRole(client);
      const first = await client.query<{ claim_id: string; storage_path: string }>(
        "select * from public.birth_giving_claim_storage_cleanup(interval '1 hour', 1)",
      );
      await client.query("reset role");
      await client.query(
        "update public.birth_giving_storage_cleanup_claims set claimed_at = now() - interval '30 minutes' where storage_path = $1",
        [storagePath],
      );
      await asServiceRole(client);
      const second = await client.query<{ claim_id: string; storage_path: string }>(
        "select * from public.birth_giving_claim_storage_cleanup(interval '1 hour', 1)",
      );

      expect(second.rows).toEqual([]);
      expect((await client.query<{ value: boolean }>(
        "select public.birth_giving_release_storage_cleanup_claim($1, $2) as value",
        [storagePath, first.rows[0].claim_id],
      )).rows[0].value).toBe(true);
      const afterRelease = await client.query<{ claim_id: string; storage_path: string }>(
        "select * from public.birth_giving_claim_storage_cleanup(interval '1 hour', 1)",
      );
      expect(afterRelease.rows[0].storage_path).toBe(storagePath);
      expect(afterRelease.rows[0].claim_id).not.toBe(first.rows[0].claim_id);
      await client.query("reset role");
      await client.query("delete from storage.objects where bucket_id = 'documents' and name = $1", [storagePath]);
      await asServiceRole(client);
      expect((await client.query<{ value: boolean }>(
        "select public.birth_giving_finalize_storage_cleanup($1, $2) as value",
        [storagePath, afterRelease.rows[0].claim_id],
      )).rows[0].value).toBe(true);
      await client.query("reset role");
      expect((await client.query<{ count: number }>(
        "select count(*)::int as count from public.birth_giving_storage_cleanup_claims where storage_path = $1",
        [storagePath],
      )).rows[0].count).toBe(0);
    });
  });

  it("rechecks assignment references after waiting for the confirmation storage lock", async () => {
    const setupClient = await getPool().connect();
    const confirmationClient = await getPool().connect();
    const claimClient = await getPool().connect();
    let eventId: string | undefined;
    let storagePath: string | undefined;
    const authUserIds: string[] = [];
    const profileIds: string[] = [];
    try {
      await setupClient.query("begin");
      const organizer = await insertVerifiedProfile(setupClient, { name: "Cleanup race organizer" });
      const member = await insertVerifiedProfile(setupClient, { name: "Cleanup race member" });
      authUserIds.push(organizer.authUserId, member.authUserId);
      profileIds.push(organizer.profileId, member.profileId);
      ({ eventId } = await seedEvent(setupClient, organizer, member, new Date(Date.now() - HOUR_MS).toISOString()));
      storagePath = `birth-giving/assignments/${eventId}/race.pdf`;
      await insertStoredObject(
        setupClient,
        storagePath,
        "application/pdf",
        1_000,
        new Date(Date.now() - 2 * HOUR_MS).toISOString(),
      );
      await setupClient.query("commit");

      await confirmationClient.query("begin");
      await confirmAssignment(
        confirmationClient,
        organizer.profileId,
        eventId,
        storagePath,
        "race.pdf",
        "application/pdf",
        1_000,
      );
      await claimClient.query("set application_name = 'birth-giving-confirmation-cleanup-race'");
      await claimClient.query("begin");
      await claimClient.query(`set local statement_timeout = '${RACE_STATEMENT_TIMEOUT_MS}ms'`);
      await asServiceRole(claimClient);
      const claim = claimClient.query<{ storage_path: string }>(
        "select storage_path from public.birth_giving_claim_storage_cleanup(interval '1 hour', 1)",
      );
      await waitForBlockedConnection("birth-giving-confirmation-cleanup-race");
      await confirmationClient.query("commit");

      await expect(claim).resolves.toMatchObject({ rows: [] });
      const references = await setupClient.query<{ count: number }>(
        "select count(*)::int as count from public.birth_giving_assignments where storage_path = $1 and state = 'present'",
        [storagePath],
      );
      expect(references.rows[0].count).toBe(1);
    } finally {
      await confirmationClient.query("rollback").catch(() => undefined);
      await claimClient.query("rollback").catch(() => undefined);
      if (storagePath) {
        await setupClient.query("delete from public.birth_giving_storage_cleanup_claims where storage_path = $1", [storagePath]);
        await setupClient.query("delete from storage.objects where bucket_id = 'documents' and name = $1", [storagePath]);
      }
      if (eventId) await setupClient.query("delete from public.birth_giving_events where id = $1", [eventId]);
      if (profileIds.length > 0) await setupClient.query("delete from public.profiles where id = any($1::uuid[])", [profileIds]);
      if (authUserIds.length > 0) {
        await setupClient.query("delete from public.users where auth_user_id = any($1::uuid[])", [authUserIds]);
        await setupClient.query("delete from auth.users where id = any($1::uuid[])", [authUserIds]);
      }
      await setupClient.query("rollback").catch(() => undefined);
      setupClient.release();
      confirmationClient.release();
      claimClient.release();
    }
  });

  it("configures the shared documents bucket for the complete safe 25 MiB allowlist", async () => {
    await withRollback(async (client) => {
      const bucket = await client.query<{ allowed_mime_types: string[]; file_size_limit: string }>(
        "select allowed_mime_types, file_size_limit::text from storage.buckets where id = 'documents'",
      );
      expect(bucket.rows[0].file_size_limit).toBe(String(25 * MIB));
      expect(bucket.rows[0].allowed_mime_types).toEqual(expect.arrayContaining([
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/png",
        "image/webp",
      ]));
      expect(bucket.rows[0].allowed_mime_types).toHaveLength(7);
    });
  });
});
