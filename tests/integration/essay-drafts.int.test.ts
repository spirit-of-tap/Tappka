import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";

const COALESCE_WINDOW_MINUTES = 30;

async function seedProfile(
  client: import("pg").PoolClient,
  teamId: string,
  name: string,
  email: string,
) {
  const auth = await insertAuthUser(client);
  const { rows: userRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [auth.id],
  );
  // Mirrors tests/integration/feedback.int.test.ts: current_profile_id() runs as
  // invoker and selects from public.profiles, so without a verified_work_email
  // the "Verified users can view all profiles" policy makes it return NULL.
  await client.query("update public.users set verified_work_email = $1 where id = $2", [
    email,
    userRows[0].id,
  ]);
  await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ($1, $2, $3, $4, 'student')`,
    [name, email, userRows[0].id, teamId],
  );
  const { rows: profiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [userRows[0].id],
  );
  return { authId: auth.id as string, profileId: profiles[0].id as string };
}

async function seed(client: import("pg").PoolClient) {
  const { rows: teams } = await client.query(
    "insert into public.teams (name) values ('Team') returning id",
  );
  const teamId = teams[0].id;

  const author = await seedProfile(client, teamId, "Author", "author@studenti.czu.cz");
  const other = await seedProfile(client, teamId, "Other", "other@studenti.czu.cz");

  const { rows: draftRows } = await client.query(
    `insert into public.essays (author_profile_id, created_by_profile_id, updated_by_profile_id, published_at)
     values ($1, $1, $1, null) returning id`,
    [author.profileId],
  );
  const { rows: publishedRows } = await client.query(
    `insert into public.essays (author_profile_id, created_by_profile_id, updated_by_profile_id, published_at)
     values ($1, $1, $1, now()) returning id`,
    [author.profileId],
  );

  for (const essayId of [draftRows[0].id, publishedRows[0].id]) {
    await client.query(
      `insert into public.essay_revisions (essay_id, revision_no, title, content_json, created_by_profile_id, updated_by_profile_id)
       values ($1, 1, 'Titul', '{}'::jsonb, $2, $2)`,
      [essayId, author.profileId],
    );
  }

  return {
    author,
    other,
    draftId: draftRows[0].id as string,
    publishedId: publishedRows[0].id as string,
  };
}

describe("koncepty RLS", () => {
  it("hides a draft essay from another authenticated user", async () => {
    await withRollback(async (client) => {
      const { other, draftId } = await seed(client);
      await asClaims(client, { sub: other.authId });

      const { rows } = await client.query("select id from public.essays where id = $1", [draftId]);
      expect(rows).toHaveLength(0);
    });
  });

  it("shows the author their own draft", async () => {
    await withRollback(async (client) => {
      const { author, draftId } = await seed(client);
      await asClaims(client, { sub: author.authId });

      const { rows } = await client.query("select id from public.essays where id = $1", [draftId]);
      expect(rows).toHaveLength(1);
    });
  });

  it("still shows published essays to everyone", async () => {
    await withRollback(async (client) => {
      const { other, publishedId } = await seed(client);
      await asClaims(client, { sub: other.authId });

      const { rows } = await client.query("select id from public.essays where id = $1", [publishedId]);
      expect(rows).toHaveLength(1);
    });
  });

  it("hides draft revision content from another authenticated user", async () => {
    await withRollback(async (client) => {
      const { other, draftId } = await seed(client);
      await asClaims(client, { sub: other.authId });

      const { rows } = await client.query(
        "select title from public.essay_revisions where essay_id = $1",
        [draftId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("shows published revision content to another authenticated user", async () => {
    await withRollback(async (client) => {
      const { other, publishedId } = await seed(client);
      await asClaims(client, { sub: other.authId });

      const { rows } = await client.query(
        "select title from public.essay_revisions where essay_id = $1",
        [publishedId],
      );
      expect(rows).toHaveLength(1);
    });
  });
});

describe("essay_revisions UPDATE window", () => {
  it("lets the author update a revision they just created", async () => {
    await withRollback(async (client) => {
      const { author, draftId } = await seed(client);
      await asClaims(client, { sub: author.authId });

      const result = await client.query(
        "update public.essay_revisions set title = 'Nový' where essay_id = $1 and revision_no = 1",
        [draftId],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it("refuses to update a revision older than the window", async () => {
    await withRollback(async (client) => {
      const { author, draftId } = await seed(client);
      await client.query(
        `update public.essay_revisions
         set created_at = now() - ($2 || ' minutes')::interval
         where essay_id = $1 and revision_no = 1`,
        [draftId, String(COALESCE_WINDOW_MINUTES + 5)],
      );
      await asClaims(client, { sub: author.authId });

      const result = await client.query(
        "update public.essay_revisions set title = 'Nový' where essay_id = $1 and revision_no = 1",
        [draftId],
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it("refuses to let another user update the author's fresh revision", async () => {
    await withRollback(async (client) => {
      const { other, draftId } = await seed(client);
      await asClaims(client, { sub: other.authId });

      const result = await client.query(
        "update public.essay_revisions set title = 'Nový' where essay_id = $1 and revision_no = 1",
        [draftId],
      );
      expect(result.rowCount).toBe(0);
    });
  });
});