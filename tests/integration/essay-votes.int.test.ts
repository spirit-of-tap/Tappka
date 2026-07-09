import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";

async function seed(client: import("pg").PoolClient) {
  const authorAuth = await insertAuthUser(client);
  const voterAuth = await insertAuthUser(client);

  const { rows: authorUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [authorAuth.id],
  );
  const { rows: voterUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [voterAuth.id],
  );

  const { rows: teams } = await client.query(
    "insert into public.teams (name) values ('Team') returning id",
  );
  const teamId = teams[0].id;

  await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ('Author', 'author@studenti.czu.cz', $1, $2, 'student')`,
    [authorUserRows[0].id, teamId],
  );
  const { rows: authorProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [authorUserRows[0].id],
  );

  await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ('Voter', 'voter@studenti.czu.cz', $1, $2, 'student')`,
    [voterUserRows[0].id, teamId],
  );
  const { rows: voterProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [voterUserRows[0].id],
  );

  const { rows: books } = await client.query(
    `insert into public.books (title, author, added_by_profile_id, status, book_points)
     values ('Book', 'Author', $1, 'approved', 2) returning id`,
    [authorProfiles[0].id],
  );

  const { rows: essays } = await client.query(
    `insert into public.essays (author_profile_id, book_id, title, content_json, content_text, published)
     values ($1, $2, 'Essay', '{}', 'Hello', true) returning id`,
    [authorProfiles[0].id, books[0].id],
  );

  return {
    authorProfileId: authorProfiles[0].id as string,
    voterProfileId: voterProfiles[0].id as string,
    essayId: essays[0].id as string,
    authorAuthId: authorAuth.id,
    voterAuthId: voterAuth.id,
  };
}

describe("essay_votes RLS SELECT", () => {
  it("authenticated users can select from essay_votes (permissive policy)", async () => {
    await withRollback(async (client) => {
      const { voterProfileId, essayId } = await seed(client);

      // Insert vote first (owner bypasses RLS)
      await client.query(
        "insert into public.essay_votes (essay_id, voter_profile_id) values ($1, $2)",
        [essayId, voterProfileId],
      );

      const { rows } = await client.query(
        "select count(*)::int as cnt from public.essay_votes where essay_id = $1",
        [essayId],
      );
      expect(rows[0].cnt).toBe(1);
    });
  });
});

describe("essay_votes trigger", () => {
  it("increments vote_count on insert", async () => {
    await withRollback(async (client) => {
      const { voterProfileId, essayId } = await seed(client);

      await client.query(
        "insert into public.essay_votes (essay_id, voter_profile_id) values ($1, $2)",
        [essayId, voterProfileId],
      );

      const { rows } = await client.query(
        "select vote_count from public.essays where id = $1",
        [essayId],
      );
      expect(Number(rows[0].vote_count)).toBe(1);
    });
  });

  it("decrements vote_count on delete", async () => {
    await withRollback(async (client) => {
      const { voterProfileId, essayId } = await seed(client);

      await client.query(
        "insert into public.essay_votes (essay_id, voter_profile_id) values ($1, $2)",
        [essayId, voterProfileId],
      );
      await client.query(
        "delete from public.essay_votes where essay_id = $1 and voter_profile_id = $2",
        [essayId, voterProfileId],
      );

      const { rows } = await client.query(
        "select vote_count from public.essays where id = $1",
        [essayId],
      );
      expect(Number(rows[0].vote_count)).toBe(0);
    });
  });
});
