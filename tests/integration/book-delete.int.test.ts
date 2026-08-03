import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";

async function seed(client: import("pg").PoolClient) {
  const coachAuth = await insertAuthUser(client);
  const authorAuth = await insertAuthUser(client);

  const { rows: coachUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [coachAuth.id],
  );
  const { rows: authorUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [authorAuth.id],
  );

  await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where id = any($1)",
    [[coachUserRows[0].id, authorUserRows[0].id]],
  );

  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Coach', 'coach@studenti.czu.cz', $1, 'coach')`,
    [coachUserRows[0].id],
  );
  const { rows: coachProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [coachUserRows[0].id],
  );

  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Author', 'author@studenti.czu.cz', $1, 'student')`,
    [authorUserRows[0].id],
  );
  const { rows: authorProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [authorUserRows[0].id],
  );

  const { rows: sourceBooks } = await client.query(
    `insert into public.books (title, author, created_by_profile_id, updated_by_profile_id, list_status, book_points)
     values ('Duplicate', 'Author', $1, $1, 'longlist', 2) returning id`,
    [coachProfiles[0].id],
  );
  const { rows: targetBooks } = await client.query(
    `insert into public.books (title, author, created_by_profile_id, updated_by_profile_id, list_status, book_points)
     values ('Original', 'Author', $1, $1, 'longlist', 2) returning id`,
    [coachProfiles[0].id],
  );

  await client.query(
    `insert into public.essays (author_profile_id, book_id, created_by_profile_id, updated_by_profile_id, published_at)
     values ($1, $2, $1, $1, now()) returning id`,
    [authorProfiles[0].id, sourceBooks[0].id],
  );

  return {
    coachProfileId: coachProfiles[0].id as string,
    coachAuthId: coachAuth.id,
    sourceBookId: sourceBooks[0].id as string,
    targetBookId: targetBooks[0].id as string,
  };
}

describe("reassign_essays_to_book", () => {
  it("moves essays of another author to the target book (SECURITY DEFINER)", async () => {
    await withRollback(async (client) => {
      const { coachAuthId, coachProfileId, sourceBookId, targetBookId } = await seed(client);

      await asClaims(client, { sub: coachAuthId });

      const { rows } = await client.query(
        "select public.reassign_essays_to_book($1, $2, $3) as moved",
        [sourceBookId, targetBookId, coachProfileId],
      );
      expect(rows[0].moved).toBe(1);

      const { rows: essays } = await client.query(
        "select count(*)::int as cnt from public.essays where book_id = $1",
        [targetBookId],
      );
      expect(essays[0].cnt).toBe(1);

      const { rows: empty } = await client.query(
        "select count(*)::int as cnt from public.essays where book_id = $1",
        [sourceBookId],
      );
      expect(empty[0].cnt).toBe(0);
    });
  });

  it("returns 0 when there are no essays on the source book", async () => {
    await withRollback(async (client) => {
      const { coachAuthId, coachProfileId, targetBookId } = await seed(client);

      const { rows: emptyBooks } = await client.query(
        `insert into public.books (title, author, created_by_profile_id, updated_by_profile_id)
         values ('No Essays', 'Author', $1, $1) returning id`,
        [coachProfileId],
      );

      await asClaims(client, { sub: coachAuthId });

      const { rows } = await client.query(
        "select public.reassign_essays_to_book($1, $2, $3) as moved",
        [emptyBooks[0].id, targetBookId, coachProfileId],
      );
      expect(rows[0].moved).toBe(0);
    });
  });
});
