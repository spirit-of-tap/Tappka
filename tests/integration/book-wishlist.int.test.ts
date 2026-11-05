import { describe, expect, it } from 'vitest';

import { insertVerifiedProfile } from '@/tests/setup/factories';
import { asClaims } from '@/tests/setup/rls';
import { withRollback } from '@/tests/setup/tx';

interface Seed {
  owner: { authUserId: string; profileId: string };
  other: { authUserId: string; profileId: string };
  bookId: string;
}

async function seed(client: import('pg').PoolClient): Promise<Seed> {
  const owner = await insertVerifiedProfile(client, { name: 'Owner' });
  const other = await insertVerifiedProfile(client, { name: 'Other' });

  const { rows } = await client.query(
    `insert into public.books (title_cs, author, created_by_profile_id, updated_by_profile_id)
     values ('Wishlist book', 'Author', $1, $1)
     returning id`,
    [owner.profileId],
  );

  return { owner, other, bookId: rows[0].id as string };
}

async function insertWishlistRow(
  client: import('pg').PoolClient,
  profileId: string,
  bookId: string,
) {
  return client.query(
    'insert into public.book_wishlist (profile_id, book_id) values ($1, $2)',
    [profileId, bookId],
  );
}

describe('book_wishlist RLS', () => {
  it('lets a user save a catalogue book and read it back', async () => {
    await withRollback(async (client) => {
      const { owner, bookId } = await seed(client);
      await asClaims(client, { sub: owner.authUserId });

      await insertWishlistRow(client, owner.profileId, bookId);

      const { rows } = await client.query(
        'select count(*)::int as cnt from public.book_wishlist where profile_id = $1',
        [owner.profileId],
      );
      expect(rows[0].cnt).toBe(1);
    });
  });

  it('hides another user’s shelf and refuses writing to it', async () => {
    await withRollback(async (client) => {
      const { owner, other, bookId } = await seed(client);
      await insertWishlistRow(client, owner.profileId, bookId);

      await asClaims(client, { sub: other.authUserId });

      const { rows } = await client.query(
        'select count(*)::int as cnt from public.book_wishlist',
      );
      expect(rows[0].cnt).toBe(0);

      await expect(insertWishlistRow(client, owner.profileId, bookId)).rejects.toThrow(
        /row-level security/,
      );
    });
  });

  it('only deletes rows on the caller’s own shelf', async () => {
    await withRollback(async (client) => {
      const { owner, other, bookId } = await seed(client);
      await asClaims(client, { sub: owner.authUserId });
      await insertWishlistRow(client, owner.profileId, bookId);

      await asClaims(client, { sub: other.authUserId });
      const otherDelete = await client.query(
        'delete from public.book_wishlist where profile_id = $1 and book_id = $2',
        [owner.profileId, bookId],
      );
      expect(otherDelete.rowCount).toBe(0);

      await asClaims(client, { sub: owner.authUserId });
      const ownDelete = await client.query(
        'delete from public.book_wishlist where profile_id = $1 and book_id = $2',
        [owner.profileId, bookId],
      );
      expect(ownDelete.rowCount).toBe(1);
    });
  });

  it('rejects saving the same book twice', async () => {
    await withRollback(async (client) => {
      const { owner, bookId } = await seed(client);
      await asClaims(client, { sub: owner.authUserId });

      await insertWishlistRow(client, owner.profileId, bookId);

      await expect(insertWishlistRow(client, owner.profileId, bookId)).rejects.toThrow(
        /book_wishlist_pkey/,
      );
    });
  });
});
