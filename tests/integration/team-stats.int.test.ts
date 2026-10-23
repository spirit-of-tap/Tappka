import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";

import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";

async function seedTeamAndStudent(client: PoolClient): Promise<{ teamId: string; profileId: string }> {
  const auth = await insertAuthUser(client, { email: "team-stats@studenti.czu.cz" });
  const { rows: userRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [auth.id],
  );

  const { rows: teamRows } = await client.query(
    "insert into public.teams (name) values ('Stats Team') returning id",
  );
  const teamId = teamRows[0].id as string;

  const { rows: profileRows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ('Stats Student', 'team-stats@studenti.czu.cz', $1, $2, 'student')
     returning id`,
    [userRows[0].id, teamId],
  );

  return { teamId, profileId: profileRows[0].id as string };
}

async function seedBook(
  client: PoolClient,
  profileId: string,
  opts: { title: string; points: string; status?: "shortlist" | "longlist" | "archived" },
): Promise<string> {
  const { rows } = await client.query(
    `insert into public.books (title_cs, author, created_by_profile_id, updated_by_profile_id, list_status, book_points)
     values ($1, 'Author', $2, $2, $3, $4) returning id`,
    [opts.title, profileId, opts.status ?? "shortlist", opts.points],
  );
  return rows[0].id as string;
}

async function seedSource(
  client: PoolClient,
  profileId: string,
  opts: { title: string; points: string },
): Promise<string> {
  const { rows } = await client.query(
    `insert into public.content_sources (kind, title, points, status, created_by_profile_id, updated_by_profile_id)
     values ('podcast', $1, $2, 'approved', $3, $3) returning id`,
    [opts.title, opts.points, profileId],
  );
  return rows[0].id as string;
}

async function seedEssay(
  client: PoolClient,
  profileId: string,
  opts: { bookId?: string | null; sourceId?: string | null; frozen?: string | null },
): Promise<void> {
  await client.query(
    `insert into public.essays
       (author_profile_id, book_id, content_source_id, frozen_book_points,
        created_by_profile_id, updated_by_profile_id, published_at)
     values ($1, $2, $3, $4, $1, $1, now())`,
    [profileId, opts.bookId ?? null, opts.sourceId ?? null, opts.frozen ?? null],
  );
}

describe("get_teams_with_member_stats", () => {
  it("counts frozen points per essay but dedupes live book and source credit", async () => {
    await withRollback(async (client) => {
      const { teamId, profileId } = await seedTeamAndStudent(client);

      const frozenBook = await seedBook(client, profileId, { title: "Deník CEO", points: "2.00" });
      const liveBook = await seedBook(client, profileId, { title: "Live Book", points: "2.00" });
      const frozenSource = await seedSource(client, profileId, { title: "Frozen Podcast", points: "2.00" });
      const liveSource = await seedSource(client, profileId, { title: "Live Podcast", points: "3.00" });

      // Three legacy episodes imported under one shared book record: each one
      // was awarded separately by the retired system, so all three count.
      for (let i = 0; i < 3; i += 1) {
        await seedEssay(client, profileId, { bookId: frozenBook, frozen: "0.33" });
      }

      // Two live essays on the same book: one credit for the book.
      await seedEssay(client, profileId, { bookId: liveBook });
      await seedEssay(client, profileId, { bookId: liveBook });

      // Two frozen essays on one shared content source: frozen wins, per essay.
      await seedEssay(client, profileId, { sourceId: frozenSource, frozen: "0.33" });
      await seedEssay(client, profileId, { sourceId: frozenSource, frozen: "0.33" });

      // Two live essays on the same source: one credit for the source.
      await seedEssay(client, profileId, { sourceId: liveSource });
      await seedEssay(client, profileId, { sourceId: liveSource });

      // Frozen essay whose old-system book was never imported.
      await seedEssay(client, profileId, { frozen: "2.00" });

      const { rows } = await client.query(
        "select * from public.get_teams_with_member_stats() where team_id = $1 and profile_id = $2",
        [teamId, profileId],
      );

      expect(rows).toHaveLength(1);
      // 3 × 0.33 + 2.00 + 2 × 0.33 + 3.00 + 2.00
      expect(Number(rows[0].book_points)).toBeCloseTo(8.65, 5);
      expect(Number(rows[0].essay_count)).toBe(10);
    });
  });
});
