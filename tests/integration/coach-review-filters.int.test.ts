import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { asClaims } from "@/tests/setup/rls";
import { insertAuthUser } from "@/tests/setup/factories";
import type { PoolClient } from "pg";

interface Seed {
  authId: string;
  profileId: string;
}

async function seedProfile(
  client: PoolClient,
  opts: { name: string; email: string; role: "student" | "coach" },
): Promise<Seed> {
  const auth = await insertAuthUser(client, { email: opts.email });
  const { rows: userRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [auth.id],
  );
  // current_profile_id() runs as invoker: without verified_work_email the
  // "Verified users can view all profiles" policy makes it return NULL.
  await client.query("update public.users set verified_work_email = $1 where id = $2", [
    opts.email,
    userRows[0].id,
  ]);
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

async function seedBook(
  client: PoolClient,
  byProfileId: string,
  opts: { title: string; points: string; status: "shortlist" | "longlist" | "archived" },
): Promise<string> {
  const { rows } = await client.query(
    `insert into public.books (title_cs, author, created_by_profile_id, updated_by_profile_id, list_status, book_points)
     values ($1, 'Author', $2, $2, $3, $4) returning id`,
    [opts.title, byProfileId, opts.status, opts.points],
  );
  return rows[0].id as string;
}

async function seedSource(
  client: PoolClient,
  byProfileId: string,
  opts: { title: string; points: string },
): Promise<string> {
  const { rows } = await client.query(
    `insert into public.content_sources (kind, title, points, status, created_by_profile_id, updated_by_profile_id)
     values ('podcast', $1, $2, 'approved', $3, $3) returning id`,
    [opts.title, opts.points, byProfileId],
  );
  return rows[0].id as string;
}

async function seedEssay(
  client: PoolClient,
  authorProfileId: string,
  opts: { bookId?: string | null; sourceId?: string | null; frozen?: string | null },
): Promise<string> {
  const { rows } = await client.query(
    `insert into public.essays
       (author_profile_id, book_id, content_source_id, frozen_book_points,
        created_by_profile_id, updated_by_profile_id, published_at)
     values ($1, $2, $3, $4, $1, $1, now()) returning id`,
    [authorProfileId, opts.bookId ?? null, opts.sourceId ?? null, opts.frozen ?? null],
  );
  return rows[0].id as string;
}

interface ReviewResult {
  essay_ids: string[];
  total_count: number;
  unread_count: number;
  read_count: number;
  has_more: boolean;
}

async function callReview(
  client: PoolClient,
  coachProfileId: string,
  points: string,
): Promise<ReviewResult> {
  const { rows } = await client.query(
    `select public.coach_review_filtered_ids($1, null, 'unread', 'all', $2, 'all', 1, 50) as result`,
    [coachProfileId, points],
  );
  return rows[0].result as ReviewResult;
}

describe("coach_review_filtered_ids points filter", () => {
  it("matches essays by resolved points (live book, frozen, content source)", async () => {
    await withRollback(async (client) => {
      const coach = await seedProfile(client, {
        name: "Coach",
        email: "review-coach@pef.czu.cz",
        role: "coach",
      });
      const student = await seedProfile(client, {
        name: "Student",
        email: "review-student@studenti.czu.cz",
        role: "student",
      });

      const live2 = await seedBook(client, coach.profileId, {
        title: "Live 2",
        points: "2",
        status: "longlist",
      });
      const archived = await seedBook(client, coach.profileId, {
        title: "Archived",
        points: "0",
        status: "archived",
      });
      const podcast = await seedSource(client, coach.profileId, {
        title: "Podcast",
        points: "2",
      });

      // All three display "2 body" in the UI (resolveEssayPoints).
      const eLive = await seedEssay(client, student.profileId, { bookId: live2 });
      const eFrozen = await seedEssay(client, student.profileId, {
        bookId: archived,
        frozen: "2",
      });
      const ePodcast = await seedEssay(client, student.profileId, { sourceId: podcast });
      // Control: a true zero-point essay.
      const zero = await seedBook(client, coach.profileId, {
        title: "Zero",
        points: "0",
        status: "shortlist",
      });
      const eZero = await seedEssay(client, student.profileId, { bookId: zero });

      await asClaims(client, { sub: coach.authId });
      const result = await callReview(client, coach.profileId, "2");

      expect(result.essay_ids).toContain(eLive);
      expect(result.essay_ids).toContain(eFrozen);
      expect(result.essay_ids).toContain(ePodcast);
      expect(result.essay_ids).not.toContain(eZero);
      expect(result.unread_count).toBe(3);
      expect(result.total_count).toBe(3);
    });
  });

  it("buckets fractional and zero resolved points under '0', excluding 1-3", async () => {
    await withRollback(async (client) => {
      const coach = await seedProfile(client, {
        name: "Coach",
        email: "review-coach2@pef.czu.cz",
        role: "coach",
      });
      const student = await seedProfile(client, {
        name: "Student",
        email: "review-student2@studenti.czu.cz",
        role: "student",
      });

      const live2 = await seedBook(client, coach.profileId, {
        title: "Live 2",
        points: "2",
        status: "longlist",
      });
      const frac = await seedBook(client, coach.profileId, {
        title: "Frac",
        points: "0.33",
        status: "shortlist",
      });
      const zero = await seedBook(client, coach.profileId, {
        title: "Zero",
        points: "0",
        status: "shortlist",
      });

      const eLive = await seedEssay(client, student.profileId, { bookId: live2 });
      const eFrac = await seedEssay(client, student.profileId, { bookId: frac });
      const eZero = await seedEssay(client, student.profileId, { bookId: zero });
      const eNone = await seedEssay(client, student.profileId, {});

      await asClaims(client, { sub: coach.authId });
      const result = await callReview(client, coach.profileId, "0");

      expect(result.essay_ids).toContain(eFrac);
      expect(result.essay_ids).toContain(eZero);
      expect(result.essay_ids).toContain(eNone);
      expect(result.essay_ids).not.toContain(eLive);
      expect(result.unread_count).toBe(3);
    });
  });
});
