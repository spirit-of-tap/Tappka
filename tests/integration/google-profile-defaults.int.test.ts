import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";

import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";

const GOOGLE_NAME = "Google User";
const GOOGLE_PICTURE = "https://lh3.googleusercontent.com/a/example";
const CUSTOM_NAME = "Admin Name";
const CUSTOM_PICTURE = "https://cdn.example.com/custom.png";

/**
 * Creates an auth user with Google metadata and returns the linked public.users id.
 */
async function seedGoogleUser(
  client: PoolClient,
  opts: { email: string; name?: string; picture?: string } = {
    email: "google@example.com",
  },
): Promise<{ authId: string; userId: string }> {
  const auth = await insertAuthUser(client, {
    email: opts.email,
    meta: {
      full_name: opts.name ?? GOOGLE_NAME,
      avatar_url: opts.picture ?? GOOGLE_PICTURE,
    },
  });

  const { rows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [auth.id],
  );

  return { authId: auth.id, userId: rows[0].id as string };
}

describe("apply_google_profile_defaults", () => {
  it("fills empty name and picture from Google metadata when linking", async () => {
    await withRollback(async (client) => {
      const { userId } = await seedGoogleUser(client, {
        email: "fill-both@example.com",
      });

      const { rows: inserted } = await client.query(
        `insert into public.profiles (name, work_email, picture)
         values (null, 'fill-both@studenti.czu.cz', null)
         returning id, name, picture`,
      );

      expect(inserted[0].name).toBeNull();
      expect(inserted[0].picture).toBeNull();

      await client.query(
        "update public.profiles set user_id = $1 where id = $2",
        [userId, inserted[0].id],
      );

      const { rows } = await client.query(
        "select name, picture from public.profiles where id = $1",
        [inserted[0].id],
      );

      expect(rows[0].name).toBe(GOOGLE_NAME);
      expect(rows[0].picture).toBe(GOOGLE_PICTURE);
    });
  });

  it("keeps an existing name and only fills an empty picture", async () => {
    await withRollback(async (client) => {
      const { userId } = await seedGoogleUser(client, {
        email: "fill-picture@example.com",
      });

      const { rows: inserted } = await client.query(
        `insert into public.profiles (name, work_email, picture)
         values ($1, 'fill-picture@studenti.czu.cz', null)
         returning id`,
        [CUSTOM_NAME],
      );

      await client.query(
        "update public.profiles set user_id = $1 where id = $2",
        [userId, inserted[0].id],
      );

      const { rows } = await client.query(
        "select name, picture from public.profiles where id = $1",
        [inserted[0].id],
      );

      expect(rows[0].name).toBe(CUSTOM_NAME);
      expect(rows[0].picture).toBe(GOOGLE_PICTURE);
    });
  });

  it("does not overwrite non-empty name or picture", async () => {
    await withRollback(async (client) => {
      const { userId } = await seedGoogleUser(client, {
        email: "keep-both@example.com",
      });

      const { rows: inserted } = await client.query(
        `insert into public.profiles (name, work_email, picture)
         values ($1, 'keep-both@studenti.czu.cz', $2)
         returning id`,
        [CUSTOM_NAME, CUSTOM_PICTURE],
      );

      await client.query(
        "update public.profiles set user_id = $1 where id = $2",
        [userId, inserted[0].id],
      );

      const { rows } = await client.query(
        "select name, picture from public.profiles where id = $1",
        [inserted[0].id],
      );

      expect(rows[0].name).toBe(CUSTOM_NAME);
      expect(rows[0].picture).toBe(CUSTOM_PICTURE);
    });
  });

  it("fills on insert when user_id is already set", async () => {
    await withRollback(async (client) => {
      const { userId } = await seedGoogleUser(client, {
        email: "insert-linked@example.com",
      });

      const { rows } = await client.query(
        `insert into public.profiles (name, work_email, picture, user_id)
         values (null, 'insert-linked@studenti.czu.cz', null, $1)
         returning name, picture`,
        [userId],
      );

      expect(rows[0].name).toBe(GOOGLE_NAME);
      expect(rows[0].picture).toBe(GOOGLE_PICTURE);
    });
  });

  it("leaves empties alone when Google metadata is missing", async () => {
    await withRollback(async (client) => {
      const auth = await insertAuthUser(client, {
        email: "no-meta@example.com",
        meta: {},
      });

      const { rows: userRows } = await client.query(
        "select id from public.users where auth_user_id = $1",
        [auth.id],
      );

      const { rows } = await client.query(
        `insert into public.profiles (name, work_email, picture, user_id)
         values (null, 'no-meta@studenti.czu.cz', null, $1)
         returning name, picture`,
        [userRows[0].id],
      );

      expect(rows[0].name).toBeNull();
      expect(rows[0].picture).toBeNull();
    });
  });
});
