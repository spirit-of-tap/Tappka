import { describe, expect, it } from 'vitest';
import { withRollback } from '@/tests/setup/tx';
import { insertAuthUser } from '@/tests/setup/factories';
import { asClaims } from '@/tests/setup/rls';

async function seedStudent(client: import('pg').PoolClient) {
  const auth = await insertAuthUser(client);
  const { rows: userRows } = await client.query(
    'select id from public.users where auth_user_id = $1',
    [auth.id],
  );
  await client.query(
    `update public.users set verified_work_email = google_email,
     verified_work_email_at = now() where id = $1`,
    [userRows[0].id],
  );
  const workEmail = `tecko-${auth.id}@studenti.czu.cz`;
  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Téčko', $2, $1, 'student')`,
    [userRows[0].id, workEmail],
  );
  const { rows } = await client.query(
    'select id from public.profiles where user_id = $1',
    [userRows[0].id],
  );
  return { authId: auth.id, profileId: rows[0].id as string };
}

describe('content_sources', () => {
  it('stores a podcast submission with self-assigned points', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      const { rows } = await client.query(
        `insert into public.content_sources
           (kind, title, creator, points, created_by_profile_id, updated_by_profile_id)
         values ('podcast', 'Founders', 'David Senra', 0.5, $1, $1)
         returning kind, title, points, status`,
        [student.profileId],
      );

      expect(rows[0].kind).toBe('podcast');
      expect(rows[0].points).toBe('0.50');
      expect(rows[0].status).toBe('pending_review');
    });
  });

  it('refuses points outside 0..3', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      await expect(
        client.query(
          `insert into public.content_sources
             (kind, title, points, created_by_profile_id, updated_by_profile_id)
           values ('podcast', 'Too much', 5, $1, $1)`,
          [student.profileId],
        ),
      ).rejects.toThrow();
    });
  });

  it('refuses a content source created on behalf of another profile', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      const other = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      await expect(
        client.query(
          `insert into public.content_sources (kind, title, created_by_profile_id, updated_by_profile_id)
           values ('podcast', 'Cizí zdroj', $1, $1)`,
          [other.profileId],
        ),
      ).rejects.toThrow();
    });
  });

  it('refuses a plain student update (coach/admin only)', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      const { rows } = await client.query(
        `insert into public.content_sources (kind, title, created_by_profile_id, updated_by_profile_id)
         values ('podcast', 'Mine', $1, $1) returning id`,
        [student.profileId],
      );

      // Postgres RLS: an UPDATE whose USING clause excludes the target row is
      // silently filtered, not rejected — it updates 0 rows rather than
      // throwing (same pattern as tests/integration/essay-comments.int.test.ts).
      const result = await client.query(
        `update public.content_sources set status = 'approved' where id = $1`,
        [rows[0].id],
      );
      expect(result.rowCount).toBe(0);
    });
  });
});

describe('essays source exclusivity', () => {
  it('refuses an essay linked to both a book and a content source', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      const { rows: bookRows } = await client.query(
        `insert into public.books (title_cs, author, created_by_profile_id, updated_by_profile_id)
         values ('Sprint', 'Jake Knapp', $1, $1) returning id`,
        [student.profileId],
      );
      const { rows: sourceRows } = await client.query(
        `insert into public.content_sources (kind, title, created_by_profile_id, updated_by_profile_id)
         values ('podcast', 'Founders', $1, $1) returning id`,
        [student.profileId],
      );

      await expect(
        client.query(
          `insert into public.essays (author_profile_id, book_id, content_source_id, created_by_profile_id, updated_by_profile_id)
           values ($1, $2, $3, $1, $1)`,
          [student.profileId, bookRows[0].id, sourceRows[0].id],
        ),
      ).rejects.toThrow();
    });
  });

  it('allows an essay linked to a content source alone', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      const { rows: sourceRows } = await client.query(
        `insert into public.content_sources (kind, title, created_by_profile_id, updated_by_profile_id)
         values ('podcast', 'Founders', $1, $1) returning id`,
        [student.profileId],
      );

      const { rows } = await client.query(
        `insert into public.essays (author_profile_id, content_source_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $1, $1) returning content_source_id, book_id`,
        [student.profileId, sourceRows[0].id],
      );

      expect(rows[0].content_source_id).toBe(sourceRows[0].id);
      expect(rows[0].book_id).toBeNull();
    });
  });
});
