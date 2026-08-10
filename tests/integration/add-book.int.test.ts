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
  // work_email must be unique (profiles_work_email_key), so it's derived from
  // the auth user's already-unique email rather than a fixed literal — the
  // third test case below seeds two students per transaction.
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

describe('adding a book', () => {
  it('stores title_en, page_count and preview_link', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      const { rows } = await client.query(
        `insert into public.books
           (title_cs, title_en, author, page_count, preview_link,
            created_by_profile_id, updated_by_profile_id)
         values ('Sprint', 'Sprint', 'Jake Knapp', 288, 'https://books.google.com/x', $1, $1)
         returning title_en, page_count, preview_link, list_status`,
        [student.profileId],
      );

      expect(rows[0].title_en).toBe('Sprint');
      expect(rows[0].page_count).toBe(288);
      expect(rows[0].preview_link).toBe('https://books.google.com/x');
      expect(rows[0].list_status).toBe('processing');
    });
  });

  it('refuses an archived book that still carries points', async () => {
    // books_archived_points_check. The app relies on this: `classify` zeroes
    // points when archiving, and this proves the database enforces it even if
    // that code path is ever bypassed.
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      await expect(
        client.query(
          `insert into public.books
             (title_cs, author, book_points, list_status,
              created_by_profile_id, updated_by_profile_id)
           values ('Zamítnutá', 'Autor', 2, 'archived', $1, $1)`,
          [student.profileId],
        ),
      ).rejects.toThrow();
    });
  });

  it('refuses a book created on behalf of another profile', async () => {
    await withRollback(async (client) => {
      const student = await seedStudent(client);
      const other = await seedStudent(client);
      await asClaims(client, { sub: student.authId });

      await expect(
        client.query(
          `insert into public.books (title_cs, author, created_by_profile_id, updated_by_profile_id)
           values ('Cizí kniha', 'Autor', $1, $1)`,
          [other.profileId],
        ),
      ).rejects.toThrow();
    });
  });
});
