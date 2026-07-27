import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import type { PoolClient } from "pg";

async function seed(client: PoolClient) {
  const ownerAuth = await insertAuthUser(client);
  const otherAuth = await insertAuthUser(client);

  const { rows: ownerUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [ownerAuth.id],
  );
  const { rows: otherUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [otherAuth.id],
  );

  await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where id = any($1)",
    [[ownerUserRows[0].id, otherUserRows[0].id]],
  );

  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Owner', 'ics-owner@studenti.czu.cz', $1, 'student')`,
    [ownerUserRows[0].id],
  );
  const { rows: ownerProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [ownerUserRows[0].id],
  );

  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Other', 'ics-other@studenti.czu.cz', $1, 'student')`,
    [otherUserRows[0].id],
  );
  const { rows: otherProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [otherUserRows[0].id],
  );

  return {
    ownerProfileId: ownerProfiles[0].id as string,
    otherProfileId: otherProfiles[0].id as string,
    ownerAuthId: ownerAuth.id as string,
    otherAuthId: otherAuth.id as string,
  };
}

async function insertSession(client: PoolClient, profileId: string, externalCoachName = "Kouč Jana") {
  const { rows } = await client.query(
    `insert into public.individual_coaching_sessions
       (profile_id, external_coach_name, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $1, $1)
     returning id`,
    [profileId, externalCoachName],
  );
  return rows[0].id as string;
}

describe("individual_coaching_sessions RLS", () => {
  it("lets the owner insert and select their own session", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await insertSession(client, ownerProfileId);

      const { rows } = await client.query(
        "select external_coach_name from public.individual_coaching_sessions where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].external_coach_name).toBe("Kouč Jana");
    });
  });

  it("does not let another authenticated user select someone else's session", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, otherAuthId } = await seed(client);
      await insertSession(client, ownerProfileId);

      await asClaims(client, { sub: otherAuthId });
      const { rows } = await client.query(
        "select id from public.individual_coaching_sessions where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows).toHaveLength(0); // RLS filters it out silently, not an error
    });
  });

  it("does not let another authenticated user insert a session for someone else's profile", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, otherProfileId, otherAuthId } = await seed(client);

      await asClaims(client, { sub: otherAuthId });
      await expect(
        client.query(
          `insert into public.individual_coaching_sessions
             (profile_id, external_coach_name, created_by_profile_id, updated_by_profile_id)
           values ($1, 'Spoof', $2, $2)`,
          [ownerProfileId, otherProfileId],
        ),
      ).rejects.toThrow();
    });
  });

  it("lets the owner update and soft-delete (removed_at) their own session", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId } = await seed(client);
      const sessionId = await insertSession(client, ownerProfileId);

      await asClaims(client, { sub: ownerAuthId });
      await client.query(
        `update public.individual_coaching_sessions
           set key_takeaways = 'Uvědomění', updated_by_profile_id = $2
         where id = $1`,
        [sessionId, ownerProfileId],
      );
      await client.query(
        `update public.individual_coaching_sessions
           set removed_at = now(), updated_by_profile_id = $2
         where id = $1`,
        [sessionId, ownerProfileId],
      );

      const { rows } = await client.query(
        "select key_takeaways, removed_at from public.individual_coaching_sessions where id = $1",
        [sessionId],
      );
      expect(rows[0].key_takeaways).toBe("Uvědomění");
      expect(rows[0].removed_at).not.toBeNull();
    });
  });

  it("does not let another authenticated user update or delete someone else's session", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, otherAuthId } = await seed(client);
      const sessionId = await insertSession(client, ownerProfileId);

      await asClaims(client, { sub: otherAuthId });
      const updateResult = await client.query(
        "update public.individual_coaching_sessions set external_coach_name = 'Hacked' where id = $1",
        [sessionId],
      );
      expect(updateResult.rowCount).toBe(0); // RLS filters the row out

      const deleteResult = await client.query(
        "delete from public.individual_coaching_sessions where id = $1",
        [sessionId],
      );
      expect(deleteResult.rowCount).toBe(0);
    });
  });

  it("cascades delete when the owning profile is removed", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId } = await seed(client);
      await insertSession(client, ownerProfileId);

      await client.query("delete from public.profiles where id = $1", [ownerProfileId]);

      const { rows } = await client.query(
        "select count(*)::int as cnt from public.individual_coaching_sessions where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows[0].cnt).toBe(0);
    });
  });
});

describe("individual_coaching_sessions coach xor constraint", () => {
  it("rejects a row with neither coach_profile_id nor external_coach_name set", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId } = await seed(client);
      await expect(
        client.query(
          `insert into public.individual_coaching_sessions
             (profile_id, created_by_profile_id, updated_by_profile_id)
           values ($1, $1, $1)`,
          [ownerProfileId],
        ),
      ).rejects.toThrow();
    });
  });

  it("rejects a row with both coach_profile_id and external_coach_name set", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId } = await seed(client);
      const coachAuth = await insertAuthUser(client);
      const { rows: coachUserRows } = await client.query(
        "select id from public.users where auth_user_id = $1",
        [coachAuth.id],
      );
      const { rows: coachRows } = await client.query(
        `insert into public.profiles (name, work_email, user_id, role)
         values ('Coach', 'ics-coach@rektorat.czu.cz', $1, 'coach')
         returning id`,
        [coachUserRows[0].id],
      );

      await expect(
        client.query(
          `insert into public.individual_coaching_sessions
             (profile_id, coach_profile_id, external_coach_name, created_by_profile_id, updated_by_profile_id)
           values ($1, $2, 'Also set', $1, $1)`,
          [ownerProfileId, coachRows[0].id],
        ),
      ).rejects.toThrow();
    });
  });

  it("accepts a row with only coach_profile_id set", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId } = await seed(client);
      const coachAuth = await insertAuthUser(client);
      const { rows: coachUserRows } = await client.query(
        "select id from public.users where auth_user_id = $1",
        [coachAuth.id],
      );
      const { rows: coachRows } = await client.query(
        `insert into public.profiles (name, work_email, user_id, role)
         values ('Coach', 'ics-coach2@rektorat.czu.cz', $1, 'coach')
         returning id`,
        [coachUserRows[0].id],
      );

      const { rows } = await client.query(
        `insert into public.individual_coaching_sessions
           (profile_id, coach_profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $1, $1)
         returning coach_profile_id, external_coach_name`,
        [ownerProfileId, coachRows[0].id],
      );
      expect(rows[0].coach_profile_id).toBe(coachRows[0].id);
      expect(rows[0].external_coach_name).toBeNull();
    });
  });
});
