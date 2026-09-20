import { describe, expect, it } from 'vitest';
import { withRollback } from '@/tests/setup/tx';
import { insertAuthUser } from '@/tests/setup/factories';
import { asClaims } from '@/tests/setup/rls';
import type { PoolClient } from 'pg';

async function seedCoach(client: PoolClient): Promise<{ authId: string; profileId: string }> {
  const auth = await insertAuthUser(client);
  const { rows: userRows } = await client.query('select id from public.users where auth_user_id = $1', [auth.id]);
  const workEmail = `kouc-${auth.id}@studenti.czu.cz`;
  await client.query('update public.users set verified_work_email = $1 where id = $2', [workEmail, userRows[0].id]);
  const { rows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Kouč', $2, $1, 'coach') returning id`,
    [userRows[0].id, workEmail],
  );
  return { authId: auth.id, profileId: rows[0].id as string };
}

describe('get_best_books_per_category', () => {
  it('returns only shortlist books, never longlist ones', async () => {
    await withRollback(async (client) => {
      const coach = await seedCoach(client);
      await asClaims(client, { sub: coach.authId });

      const { rows: tagRows } = await client.query(
        `insert into public.tags (name, created_by_profile_id, updated_by_profile_id)
         values ('Leadership', $1, $1) returning id`,
        [coach.profileId],
      );
      const tagId = tagRows[0].id as string;

      for (const [title, status] of [['Ověřená', 'shortlist'], ['Čekající', 'longlist']] as const) {
        const { rows: bookRows } = await client.query(
          `insert into public.books (title_cs, author, created_by_profile_id, updated_by_profile_id, list_status, book_points)
           values ($1, 'Autor', $2, $2, $3, 2) returning id`,
          [title, coach.profileId, status],
        );
        await client.query(
          `insert into public.book_tags (book_id, tag_id, created_by_profile_id, updated_by_profile_id)
           values ($1, $2, $3, $3)`,
          [bookRows[0].id, tagId, coach.profileId],
        );
      }

      const { rows } = await client.query('select * from public.get_best_books_per_category(3)');

      expect(rows.map((r: { title: string }) => r.title)).toEqual(['Ověřená']);
    });
  });
});
