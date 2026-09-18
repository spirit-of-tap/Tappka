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

  const { rows: books } = await client.query(
    `insert into public.books (title_cs, author, created_by_profile_id, updated_by_profile_id, list_status, book_points)
     values ('Mistaken Podcast', 'Host', $1, $1, 'longlist', 2) returning id`,
    [coachProfiles[0].id],
  );
  const { rows: sources } = await client.query(
    `insert into public.content_sources (kind, title, creator, status, points, created_by_profile_id, updated_by_profile_id)
     values ('podcast', 'Real Podcast', 'Host', 'approved', 0.5, $1, $1),
            ('podcast', 'Other Podcast', 'Host', 'approved', 1, $1, $1) returning id`,
    [coachProfiles[0].id],
  );

  await client.query(
    `insert into public.essays (author_profile_id, book_id, created_by_profile_id, updated_by_profile_id, published_at)
     values ($1, $2, $1, $1, now())`,
    [authorProfiles[0].id, books[0].id],
  );

  return {
    coachProfileId: coachProfiles[0].id as string,
    coachAuthId: coachAuth.id,
    authorProfileId: authorProfiles[0].id as string,
    bookId: books[0].id as string,
    sourceId: sources[0].id as string,
    otherSourceId: sources[1].id as string,
  };
}

describe("reassign_essays_to_content_source (book -> source)", () => {
  it("moves another author's essays from a book to a content source", async () => {
    await withRollback(async (client) => {
      const { coachAuthId, coachProfileId, bookId, sourceId } = await seed(client);

      await asClaims(client, { sub: coachAuthId });

      const { rows } = await client.query(
        "select public.reassign_essays_to_content_source($1, $2, $3) as moved",
        [bookId, sourceId, coachProfileId],
      );
      expect(rows[0].moved).toBe(1);

      const { rows: essays } = await client.query(
        "select book_id, content_source_id from public.essays where content_source_id = $1",
        [sourceId],
      );
      expect(essays).toHaveLength(1);
      expect(essays[0].book_id).toBeNull();

      const { rows: left } = await client.query(
        "select count(*)::int as cnt from public.essays where book_id = $1",
        [bookId],
      );
      expect(left[0].cnt).toBe(0);
    });
  });

  it("returns 0 when the book has no essays", async () => {
    await withRollback(async (client) => {
      const { coachAuthId, coachProfileId, sourceId } = await seed(client);
      const { rows: emptyBooks } = await client.query(
        `insert into public.books (title_cs, author, created_by_profile_id, updated_by_profile_id)
         values ('No Essays', 'Author', $1, $1) returning id`,
        [coachProfileId],
      );

      await asClaims(client, { sub: coachAuthId });

      const { rows } = await client.query(
        "select public.reassign_essays_to_content_source($1, $2, $3) as moved",
        [emptyBooks[0].id, sourceId, coachProfileId],
      );
      expect(rows[0].moved).toBe(0);
    });
  });
});

describe("reassign_content_source_essays (source -> book | source)", () => {
  it("moves essays from a source to a book", async () => {
    await withRollback(async (client) => {
      const { coachAuthId, coachProfileId, authorProfileId, sourceId } =
        await seed(client);
      const { rows: targetBooks } = await client.query(
        `insert into public.books (title_cs, author, created_by_profile_id, updated_by_profile_id, list_status, book_points)
         values ('Real Book', 'Author', $1, $1, 'longlist', 2) returning id`,
        [coachProfileId],
      );
      await client.query(
        `insert into public.essays (author_profile_id, content_source_id, created_by_profile_id, updated_by_profile_id, published_at)
         values ($1, $2, $1, $1, now())`,
        [authorProfileId, sourceId],
      );

      await asClaims(client, { sub: coachAuthId });

      const { rows } = await client.query(
        "select public.reassign_content_source_essays($1, $2, null, $3) as moved",
        [sourceId, targetBooks[0].id, coachProfileId],
      );
      expect(rows[0].moved).toBe(1);

      const { rows: essays } = await client.query(
        "select book_id, content_source_id from public.essays where book_id = $1",
        [targetBooks[0].id],
      );
      expect(essays).toHaveLength(1);
      expect(essays[0].content_source_id).toBeNull();
    });
  });

  it("moves essays from one source to another source", async () => {
    await withRollback(async (client) => {
      const { coachAuthId, coachProfileId, authorProfileId, sourceId, otherSourceId } =
        await seed(client);
      void coachProfileId;
      await client.query(
        `insert into public.essays (author_profile_id, content_source_id, created_by_profile_id, updated_by_profile_id, published_at)
         values ($1, $2, $1, $1, now())`,
        [authorProfileId, sourceId],
      );

      await asClaims(client, { sub: coachAuthId });

      const { rows } = await client.query(
        "select public.reassign_content_source_essays($1, null, $2, (select id from public.profiles limit 1)) as moved",
        [sourceId, otherSourceId],
      );
      expect(rows[0].moved).toBe(1);

      const { rows: essays } = await client.query(
        "select count(*)::int as cnt from public.essays where content_source_id = $1",
        [otherSourceId],
      );
      expect(essays[0].cnt).toBe(1);
    });
  });
});
