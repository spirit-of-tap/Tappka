import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";

import { withRollback } from "@/tests/setup/tx";
import { asClaims } from "@/tests/setup/rls";
import { insertAuthUser } from "@/tests/setup/factories";

interface Seed {
  authId: string;
  profileId: string;
}

async function seedTeam(client: PoolClient, name: string): Promise<string> {
  const { rows } = await client.query(
    "insert into public.teams (name) values ($1) returning id",
    [name],
  );
  return rows[0].id as string;
}

async function seedProfile(
  client: PoolClient,
  opts: { name: string; email: string; role: "student" | "coach" | "admin"; teamId: string },
): Promise<Seed> {
  const auth = await insertAuthUser(client, { email: opts.email });
  const { rows: userRows } = await client.query(
    "update public.users set verified_work_email = $1 where auth_user_id = $2 returning id",
    [opts.email, auth.id],
  );
  const { rows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ($1, $2, $3, $4, $5) returning id`,
    [opts.name, opts.email, userRows[0].id, opts.teamId, opts.role],
  );
  return { authId: auth.id, profileId: rows[0].id as string };
}

async function seedEssay(client: PoolClient, authorProfileId: string): Promise<string> {
  const { rows } = await client.query(
    `insert into public.essays (author_profile_id, created_by_profile_id, updated_by_profile_id, published_at)
     values ($1, $1, $1, now()) returning id`,
    [authorProfileId],
  );
  return rows[0].id as string;
}

async function markRead(client: PoolClient, essayId: string, coachProfileId: string): Promise<void> {
  await client.query(
    `insert into public.essay_coach_reads (essay_id, coach_profile_id, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $2, $2)`,
    [essayId, coachProfileId],
  );
}

async function visibleReaderIds(client: PoolClient, essayId: string): Promise<string[]> {
  const { rows } = await client.query(
    "select coach_profile_id from public.essay_coach_reads where essay_id = $1",
    [essayId],
  );
  return rows.map((r) => r.coach_profile_id as string);
}

describe("essay_coach_reads RLS SELECT", () => {
  it("coach of the same team sees reads by other coaches", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "Team A");
      const coachA = await seedProfile(client, { name: "A", email: "reads-a@pef.czu.cz", role: "coach", teamId });
      const coachB = await seedProfile(client, { name: "B", email: "reads-b@pef.czu.cz", role: "coach", teamId });
      const student = await seedProfile(client, { name: "S", email: "reads-s@studenti.czu.cz", role: "student", teamId });
      const essayId = await seedEssay(client, student.profileId);
      await markRead(client, essayId, coachA.profileId);

      await asClaims(client, { sub: coachB.authId });
      expect(await visibleReaderIds(client, essayId)).toEqual([coachA.profileId]);
    });
  });

  it("coach of another team does not see the reads", async () => {
    await withRollback(async (client) => {
      const teamA = await seedTeam(client, "Team A");
      const teamB = await seedTeam(client, "Team B");
      const coachA = await seedProfile(client, { name: "A", email: "reads-a2@pef.czu.cz", role: "coach", teamId: teamA });
      const outsider = await seedProfile(client, { name: "O", email: "reads-o2@pef.czu.cz", role: "coach", teamId: teamB });
      const student = await seedProfile(client, { name: "S", email: "reads-s2@studenti.czu.cz", role: "student", teamId: teamA });
      const essayId = await seedEssay(client, student.profileId);
      await markRead(client, essayId, coachA.profileId);

      await asClaims(client, { sub: outsider.authId });
      expect(await visibleReaderIds(client, essayId)).toEqual([]);
    });
  });
});

interface ReviewResult {
  essay_ids: string[];
  unread_count: number;
  read_count: number;
}

async function callReview(client: PoolClient, coachProfileId: string, tab: "unread" | "read"): Promise<ReviewResult> {
  const { rows } = await client.query(
    `select public.coach_review_filtered_ids($1, null, $2, 'all', 'all', 'all', 1, 50) as result`,
    [coachProfileId, tab],
  );
  return rows[0].result as ReviewResult;
}

describe("essay_coach_reads is team-wide", () => {
  it("an essay read by one coach is in the read tab for every coach", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "Team A");
      const coachA = await seedProfile(client, { name: "A", email: "tw-a@pef.czu.cz", role: "coach", teamId });
      const coachB = await seedProfile(client, { name: "B", email: "tw-b@pef.czu.cz", role: "coach", teamId });
      const student = await seedProfile(client, { name: "S", email: "tw-s@studenti.czu.cz", role: "student", teamId });
      const readEssay = await seedEssay(client, student.profileId);
      const unreadEssay = await seedEssay(client, student.profileId);
      await markRead(client, readEssay, coachA.profileId);

      await asClaims(client, { sub: coachB.authId });
      const unread = await callReview(client, coachB.profileId, "unread");
      const read = await callReview(client, coachB.profileId, "read");

      expect(unread.essay_ids).toEqual([unreadEssay]);
      expect(read.essay_ids).toEqual([readEssay]);
      expect(unread.unread_count).toBe(1);
      expect(unread.read_count).toBe(1);
    });
  });

  it("another coach of the team can mark it unread again for everyone", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "Team A");
      const coachA = await seedProfile(client, { name: "A", email: "tw-a2@pef.czu.cz", role: "coach", teamId });
      const coachB = await seedProfile(client, { name: "B", email: "tw-b2@pef.czu.cz", role: "coach", teamId });
      const student = await seedProfile(client, { name: "S", email: "tw-s2@studenti.czu.cz", role: "student", teamId });
      const essayId = await seedEssay(client, student.profileId);
      await markRead(client, essayId, coachA.profileId);

      await asClaims(client, { sub: coachB.authId });
      const { rowCount } = await client.query(
        "delete from public.essay_coach_reads where essay_id = $1",
        [essayId],
      );

      expect(rowCount).toBe(1);
    });
  });
});

describe("coach review inbox includes admin-authored essays", () => {
  it("coaches and the admin author both see the admin's essay", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "Team A");
      const coach = await seedProfile(client, { name: "C", email: "adm-c@pef.czu.cz", role: "coach", teamId });
      const admin = await seedProfile(client, { name: "Adm", email: "adm-a@pef.czu.cz", role: "admin", teamId });
      const essayId = await seedEssay(client, admin.profileId);

      await asClaims(client, { sub: coach.authId });
      expect((await callReview(client, coach.profileId, "unread")).essay_ids).toEqual([essayId]);

      await asClaims(client, { sub: admin.authId });
      expect((await callReview(client, admin.profileId, "unread")).essay_ids).toEqual([essayId]);
    });
  });
});

describe("coach review search", () => {
  it("matches student name, Czech/English book title, author and treats wildcards literally", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "Team A");
      const coach = await seedProfile(client, { name: "C", email: "srch-c@pef.czu.cz", role: "coach", teamId });
      const anna = await seedProfile(client, { name: "Anna Nováková", email: "srch-a@studenti.czu.cz", role: "student", teamId });
      const petr = await seedProfile(client, { name: "Petr Dvořák", email: "srch-p@studenti.czu.cz", role: "student", teamId });
      const { rows: books } = await client.query(
        `insert into public.books (title_cs, title_en, author, created_by_profile_id, updated_by_profile_id, list_status, book_points)
         values ('Štíhlý startup', 'The Lean Startup', 'Eric Ries', $1, $1, 'longlist', 2) returning id`,
        [coach.profileId],
      );
      const annaEssay = await seedEssay(client, anna.profileId);
      const { rows: petrRows } = await client.query(
        `insert into public.essays (author_profile_id, book_id, created_by_profile_id, updated_by_profile_id, published_at)
         values ($1, $2, $1, $1, now()) returning id`,
        [petr.profileId, books[0].id],
      );

      await asClaims(client, { sub: coach.authId });
      const search = async (q: string) => {
        const { rows } = await client.query(
          `select public.coach_review_filtered_ids($1, null, 'unread', 'all', 'all', 'all', 1, 50, $2) as r`,
          [coach.profileId, q],
        );
        return (rows[0].r as ReviewResult).essay_ids;
      };

      expect(await search("nováK")).toEqual([annaEssay]);
      expect(await search("štíhlý")).toEqual([petrRows[0].id]);
      expect(await search("lean")).toEqual([petrRows[0].id]);
      expect(await search("ries")).toEqual([petrRows[0].id]);
      expect(await search("%")).toEqual([]);
      expect((await search("  ")).sort()).toEqual([annaEssay, petrRows[0].id].sort());
    });
  });
});
