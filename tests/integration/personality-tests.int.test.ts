import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import type { PoolClient } from "pg";

async function seed(client: PoolClient) {
  const ownerAuth = await insertAuthUser(client);
  const otherAuth = await insertAuthUser(client);
  const unverifiedAuth = await insertAuthUser(client);

  const { rows: ownerUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [ownerAuth.id],
  );
  const { rows: otherUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [otherAuth.id],
  );
  const { rows: unverifiedUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [unverifiedAuth.id],
  );

  await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where id = any($1)",
    [[ownerUserRows[0].id, otherUserRows[0].id]],
  );

  const profile = async (name: string, email: string, userId: string) => {
    const { rows } = await client.query(
      `insert into public.profiles (name, work_email, user_id, role)
       values ($1, $2, $3, 'student') returning id`,
      [name, email, userId],
    );
    return rows[0].id as string;
  };

  const ownerProfileId = await profile("Owner", "pt-owner@studenti.czu.cz", ownerUserRows[0].id);
  const otherProfileId = await profile("Other", "pt-other@studenti.czu.cz", otherUserRows[0].id);
  const unverifiedProfileId = await profile("Unverified", "pt-unverified@studenti.czu.cz", unverifiedUserRows[0].id);

  return {
    ownerProfileId,
    otherProfileId,
    unverifiedProfileId,
    ownerAuthId: ownerAuth.id as string,
    otherAuthId: otherAuth.id as string,
    unverifiedAuthId: unverifiedAuth.id as string,
  };
}

async function insertTest(
  client: PoolClient,
  profileId: string,
  testType = "mbti",
  overrides: { testTypeOther?: string | null } = {},
) {
  const { rows } = await client.query(
    `insert into public.personality_tests
       (profile_id, test_type, test_type_other, tested_on, file_path, file_name, file_size, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, '2026-03-10', 'personality-test/p1/x.pdf', 'x.pdf', 1024, $4, $4)
     returning id`,
    [profileId, testType, overrides.testTypeOther ?? null, profileId],
  );
  return rows[0].id as string;
}

describe("personality_tests RLS", () => {
  it("lets the owner insert and another verified user select their tests", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId, otherAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await insertTest(client, ownerProfileId);

      await asClaims(client, { sub: otherAuthId });
      const { rows } = await client.query(
        "select test_type from public.personality_tests where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].test_type).toBe("mbti");
    });
  });

  it("does not let an unverified user select tests", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId, unverifiedAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await insertTest(client, ownerProfileId);

      await asClaims(client, { sub: unverifiedAuthId });
      const { rows } = await client.query(
        "select id from public.personality_tests where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows).toHaveLength(0); // RLS filters it out silently
    });
  });

  it("does not let another user insert a test for someone else", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, otherAuthId } = await seed(client);

      await asClaims(client, { sub: otherAuthId });
      await expect(
        client.query(
          `insert into public.personality_tests
             (profile_id, test_type, tested_on, file_path, file_name, file_size, created_by_profile_id, updated_by_profile_id)
           values ($1, 'mbti', '2026-03-10', 'personality-test/p1/x.pdf', 'x.pdf', 1024, $2, $2)`,
          [ownerProfileId, otherAuthId],
        ),
      ).rejects.toThrow();
    });
  });

  it("lets the owner update and soft-delete their test; other users cannot", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId, otherAuthId } = await seed(client);
      const testId = await insertTest(client, ownerProfileId);

      await asClaims(client, { sub: ownerAuthId });
      await client.query(
        `update public.personality_tests
           set tested_on = '2026-04-01', updated_by_profile_id = $2
         where id = $1`,
        [testId, ownerProfileId],
      );
      await client.query(
        `update public.personality_tests
           set removed_at = now(), updated_by_profile_id = $2
         where id = $1`,
        [testId, ownerProfileId],
      );

      const { rows } = await client.query(
        "select tested_on, removed_at from public.personality_tests where id = $1",
        [testId],
      );
      expect(rows[0].tested_on).toBe("2026-04-01");
      expect(rows[0].removed_at).not.toBeNull();

      const { rows: activeRows } = await client.query(
        "select id from public.personality_tests where profile_id = $1 and removed_at is null",
        [ownerProfileId],
      );
      expect(activeRows).toHaveLength(0); // soft-deleted rows are filtered by the app query

      await asClaims(client, { sub: otherAuthId });
      const updateResult = await client.query(
        "update public.personality_tests set test_type = 'disc' where id = $1",
        [testId],
      );
      expect(updateResult.rowCount).toBe(0); // RLS filters the row out

      const deleteResult = await client.query(
        "delete from public.personality_tests where id = $1",
        [testId],
      );
      expect(deleteResult.rowCount).toBe(0);
    });
  });

  it("rejects 'other' test type without a custom name", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await expect(
        client.query(
          `insert into public.personality_tests
             (profile_id, test_type, tested_on, file_path, file_name, file_size, created_by_profile_id, updated_by_profile_id)
           values ($1, 'other', '2026-03-10', 'personality-test/p1/x.pdf', 'x.pdf', 1024, $2, $2)`,
          [ownerProfileId, ownerAuthId],
        ),
      ).rejects.toThrow();
    });
  });

  it("cascades delete when the profile is removed", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await insertTest(client, ownerProfileId);

      await client.query("set local role service_role");
      await client.query("delete from public.profiles where id = $1", [ownerProfileId]);

      const { rows } = await client.query(
        "select count(*)::int as cnt from public.personality_tests where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows[0].cnt).toBe(0);
    });
  });
});