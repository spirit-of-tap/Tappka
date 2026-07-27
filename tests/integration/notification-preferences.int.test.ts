import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";

async function seed(client: import("pg").PoolClient) {
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

  // Required for current_profile_id() to resolve for these test users —
  // profiles' own SELECT policy gates on the caller's verified_work_email.
  await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where id = any($1)",
    [[ownerUserRows[0].id, otherUserRows[0].id]],
  );

  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Owner', 'owner@studenti.czu.cz', $1, 'student')`,
    [ownerUserRows[0].id],
  );
  const { rows: ownerProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [ownerUserRows[0].id],
  );

  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Other', 'other@studenti.czu.cz', $1, 'student')`,
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

describe("notification_preferences rows", () => {
  it("upserts a row for a profile and reads it back", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId } = await seed(client);

      await client.query(
        `insert into public.notification_preferences
           (profile_id, essay_vote_email, created_by_profile_id, updated_by_profile_id)
         values ($1, false, $1, $1)`,
        [ownerProfileId],
      );

      const { rows } = await client.query(
        "select essay_vote_email, essay_comment_email from public.notification_preferences where profile_id = $1",
        [ownerProfileId],
      );

      expect(rows[0].essay_vote_email).toBe(false);
      expect(rows[0].essay_comment_email).toBe(true); // column default, untouched by the insert
    });
  });

  it("cascades delete when the owning profile is removed", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId } = await seed(client);

      await client.query(
        `insert into public.notification_preferences (profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $1, $1)`,
        [ownerProfileId],
      );
      await client.query("delete from public.profiles where id = $1", [ownerProfileId]);

      const { rows } = await client.query(
        "select count(*)::int as cnt from public.notification_preferences where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows[0].cnt).toBe(0);
    });
  });
});

describe("notification_preferences RLS", () => {
  it("lets the owner select their own row", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId } = await seed(client);

      await client.query(
        `insert into public.notification_preferences (profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $1, $1)`,
        [ownerProfileId],
      );

      await asClaims(client, { sub: ownerAuthId });
      const { rows } = await client.query(
        "select profile_id from public.notification_preferences where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows).toHaveLength(1);
    });
  });

  it("lets the owner insert and then update their own row", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await client.query(
        `insert into public.notification_preferences (profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $1, $1)`,
        [ownerProfileId],
      );
      await client.query(
        `update public.notification_preferences set essay_vote_email = false, updated_by_profile_id = $1
         where profile_id = $1`,
        [ownerProfileId],
      );

      const { rows } = await client.query(
        "select essay_vote_email from public.notification_preferences where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows[0].essay_vote_email).toBe(false);
    });
  });

  it("does not let another authenticated user select someone else's row directly", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, otherAuthId } = await seed(client);

      await client.query(
        `insert into public.notification_preferences (profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $1, $1)`,
        [ownerProfileId],
      );

      await asClaims(client, { sub: otherAuthId });
      const { rows } = await client.query(
        "select profile_id from public.notification_preferences where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows).toHaveLength(0); // RLS filters it out silently, not an error
    });
  });

  it("does not let another authenticated user insert a row for someone else's profile", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, otherAuthId } = await seed(client);

      await asClaims(client, { sub: otherAuthId });
      await expect(
        client.query(
          `insert into public.notification_preferences (profile_id, created_by_profile_id, updated_by_profile_id)
           values ($1, $1, $1)`,
          [ownerProfileId],
        ),
      ).rejects.toThrow();
    });
  });
});

describe("get_notification_preferences RPC", () => {
  it("returns all-true defaults when no row exists yet", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId } = await seed(client);

      const { rows } = await client.query(
        "select * from public.get_notification_preferences($1)",
        [ownerProfileId],
      );

      expect(rows[0]).toEqual({
        essay_coach_read_email: true,
        essay_comment_email: true,
        essay_vote_email: true,
      });
    });
  });

  it("returns the stored values when a row exists", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId } = await seed(client);

      await client.query(
        `insert into public.notification_preferences
           (profile_id, essay_comment_email, created_by_profile_id, updated_by_profile_id)
         values ($1, false, $1, $1)`,
        [ownerProfileId],
      );

      const { rows } = await client.query(
        "select * from public.get_notification_preferences($1)",
        [ownerProfileId],
      );

      expect(rows[0]).toEqual({
        essay_coach_read_email: true,
        essay_comment_email: false,
        essay_vote_email: true,
      });
    });
  });

  it("lets another authenticated user read a profile's preferences via the RPC, bypassing the owner-only SELECT policy", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, otherAuthId } = await seed(client);

      await client.query(
        `insert into public.notification_preferences
           (profile_id, essay_vote_email, created_by_profile_id, updated_by_profile_id)
         values ($1, false, $1, $1)`,
        [ownerProfileId],
      );

      await asClaims(client, { sub: otherAuthId });

      // Direct table access is still blocked for the other user...
      const direct = await client.query(
        "select profile_id from public.notification_preferences where profile_id = $1",
        [ownerProfileId],
      );
      expect(direct.rows).toHaveLength(0);

      // ...but the RPC (security definer) correctly returns the owner's real preferences.
      const { rows } = await client.query(
        "select * from public.get_notification_preferences($1)",
        [ownerProfileId],
      );
      expect(rows[0]).toEqual({
        essay_coach_read_email: true,
        essay_comment_email: true,
        essay_vote_email: false,
      });
    });
  });
});
