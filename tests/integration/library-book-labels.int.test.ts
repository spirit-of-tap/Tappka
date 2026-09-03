import { describe, expect, it } from 'vitest';

import { insertVerifiedProfile } from '@/tests/setup/factories';
import { withRollback } from '@/tests/setup/tx';

async function seedBook(client: import('pg').PoolClient): Promise<{
  bookId: string;
  profileId: string;
}> {
  const { profileId } = await insertVerifiedProfile(client);
  const { rows } = await client.query(
    `insert into public.books
       (title_cs, author, created_by_profile_id, updated_by_profile_id)
     values ('Testovací kniha', 'Testující autor:ka', $1, $1)
     returning id`,
    [profileId],
  );

  return { bookId: rows[0].id as string, profileId };
}

describe('library book label codes', () => {
  it('requires label codes to be unique across physical copies', async () => {
    await withRollback(async (client) => {
      const { bookId, profileId } = await seedBook(client);
      const insertCopy = (labelCode: number) => client.query(
        `insert into public.library_books
           (book_id, label_code, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $3, $3)`,
        [bookId, labelCode, profileId],
      );

      await insertCopy(1);

      await expect(insertCopy(1)).rejects.toThrow(/library_books_label_code_key/);
    });
  });

  it('requires label codes to be positive', async () => {
    await withRollback(async (client) => {
      const { bookId, profileId } = await seedBook(client);

      await expect(client.query(
        `insert into public.library_books
           (book_id, label_code, created_by_profile_id, updated_by_profile_id)
         values ($1, 0, $2, $2)`,
        [bookId, profileId],
      )).rejects.toThrow(/library_books_label_code_check/);
    });
  });

  it('keeps existing unlabelled copies valid during the rollout', async () => {
    await withRollback(async (client) => {
      const { bookId, profileId } = await seedBook(client);
      const { rows } = await client.query(
        `insert into public.library_books
           (book_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, $2)
         returning label_code`,
        [bookId, profileId],
      );

      expect(rows[0].label_code).toBeNull();
    });
  });
});
