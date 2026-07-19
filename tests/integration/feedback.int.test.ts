import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { asClaims } from "@/tests/setup/rls";
import { insertAuthUser } from "@/tests/setup/factories";
import type { PoolClient } from "pg";

async function seedProfile(
  client: PoolClient,
  opts: { name: string; email: string; role: "student" | "admin" },
) {
  const auth = await insertAuthUser(client);
  const { rows: userRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [auth.id],
  );
  // Set verified_work_email so the "Verified users can view all profiles" RLS
  // policy allows this user to see profiles at all -- current_profile_id() runs
  // as invoker and internally selects from public.profiles, so without this it
  // silently returns NULL for every synthetic test user (mirrors the same step
  // in tests/e2e/fixtures/auth.ts).
  await client.query(
    "update public.users set verified_work_email = $1 where id = $2",
    [opts.email, userRows[0].id],
  );
  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ($1, $2, $3, $4)`,
    [opts.name, opts.email, userRows[0].id, opts.role],
  );
  const { rows: profileRows } = await client.query(
    "select id from public.profiles where user_id = $1",
    [userRows[0].id],
  );
  return { authId: auth.id as string, profileId: profileRows[0].id as string };
}

async function insertFeedback(
  client: PoolClient,
  profileId: string,
  body: string,
  extras: { resolvedAt?: string | null } = {},
) {
  if (extras.resolvedAt) {
    await client.query(
      `insert into public.feedback
        (author_profile_id, body, created_by_profile_id, updated_by_profile_id, resolved_at)
       values ($1, $2, $1, $1, $3)`,
      [profileId, body, extras.resolvedAt],
    );
    return;
  }

  const { rows } = await client.query(
    `insert into public.feedback
      (author_profile_id, body, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $1, $1)
     returning id`,
    [profileId, body],
  );
  return rows[0]?.id as string | undefined;
}

describe("feedback RLS", () => {
  it("author can insert feedback as themselves", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, {
        name: "Student",
        email: "student1@studenti.czu.cz",
        role: "student",
      });
      await asClaims(client, { sub: author.authId });
      await insertFeedback(client, author.profileId, "Přidejte tmavý režim");
      const { rows } = await client.query(
        "select count(*)::int as cnt from public.feedback where author_profile_id = $1",
        [author.profileId],
      );
      expect(rows[0].cnt).toBe(1);
    });
  });

  it("author cannot insert feedback as someone else", async () => {
    await withRollback(async (client) => {
      const a = await seedProfile(client, { name: "A", email: "a@studenti.czu.cz", role: "student" });
      const b = await seedProfile(client, { name: "B", email: "b@studenti.czu.cz", role: "student" });
      await asClaims(client, { sub: a.authId });
      await expect(
        client.query(
          `insert into public.feedback
            (author_profile_id, body, created_by_profile_id, updated_by_profile_id)
           values ($1, $2, $3, $3)`,
          [b.profileId, "spoof", a.profileId],
        ),
      ).rejects.toThrow();
    });
  });

  it("everyone can select all feedback", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, { name: "A", email: "a2@studenti.czu.cz", role: "student" });
      const other = await seedProfile(client, { name: "O", email: "o@studenti.czu.cz", role: "student" });
      await insertFeedback(client, author.profileId, "note");
      await asClaims(client, { sub: other.authId });
      const { rows } = await client.query("select count(*)::int as cnt from public.feedback");
      expect(rows[0].cnt).toBe(1);
    });
  });

  it("non-admin cannot update (resolve); admin can", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, { name: "A", email: "a3@studenti.czu.cz", role: "student" });
      const admin = await seedProfile(client, { name: "Admin", email: "admin@rektorat.czu.cz", role: "admin" });
      const feedbackId = await insertFeedback(client, author.profileId, "note");

      await asClaims(client, { sub: author.authId });
      const nonAdmin = await client.query(
        "update public.feedback set resolved_at = now() where id = $1",
        [feedbackId],
      );
      expect(nonAdmin.rowCount).toBe(0); // RLS filters the row out

      await asClaims(client, { sub: admin.authId });
      const asAdmin = await client.query(
        "update public.feedback set resolved_at = now(), updated_by_profile_id = $2 where id = $1",
        [feedbackId, admin.profileId],
      );
      expect(asAdmin.rowCount).toBe(1);
    });
  });

  it("author can delete own note; unrelated non-admin cannot", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, { name: "A", email: "a4@studenti.czu.cz", role: "student" });
      const other = await seedProfile(client, { name: "O", email: "o2@studenti.czu.cz", role: "student" });
      const feedbackId = await insertFeedback(client, author.profileId, "note");

      await asClaims(client, { sub: other.authId });
      const otherDel = await client.query("delete from public.feedback where id = $1", [feedbackId]);
      expect(otherDel.rowCount).toBe(0);

      await asClaims(client, { sub: author.authId });
      const ownDel = await client.query("delete from public.feedback where id = $1", [feedbackId]);
      expect(ownDel.rowCount).toBe(1);
    });
  });

  it("rejects empty and over-length body via check constraint", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, { name: "A", email: "a5@studenti.czu.cz", role: "student" });
      await expect(
        client.query(
          `insert into public.feedback
            (author_profile_id, body, created_by_profile_id, updated_by_profile_id)
           values ($1, $2, $1, $1)`,
          [author.profileId, ""],
        ),
      ).rejects.toThrow();

      const overLengthBody = "a".repeat(4001);
      await expect(
        client.query(
          `insert into public.feedback
            (author_profile_id, body, created_by_profile_id, updated_by_profile_id)
           values ($1, $2, $1, $1)`,
          [author.profileId, overLengthBody],
        ),
      ).rejects.toThrow();
    });
  });

  it("has an updated_at refresh trigger registered on public.feedback", async () => {
    await withRollback(async (client) => {
      const { rows } = await client.query(
        `select t.tgname
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         where c.relname = 'feedback'
           and t.tgname = 'feedback_updated_at_trigger'
           and not t.tgisinternal`,
      );
      expect(rows).toHaveLength(1);
    });
  });
});

describe("feedback active/resolved split", () => {
  it("active excludes resolved; resolved includes only resolved", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, { name: "A", email: "split@studenti.czu.cz", role: "student" });
      await insertFeedback(client, author.profileId, "active-one");
      await insertFeedback(client, author.profileId, "archived-one", {
        resolvedAt: new Date().toISOString(),
      });

      const active = await client.query(
        "select body from public.feedback where resolved_at is null",
      );
      const resolved = await client.query(
        "select body from public.feedback where resolved_at is not null",
      );
      expect(active.rows.map((r) => r.body)).toEqual(["active-one"]);
      expect(resolved.rows.map((r) => r.body)).toEqual(["archived-one"]);
    });
  });
});
