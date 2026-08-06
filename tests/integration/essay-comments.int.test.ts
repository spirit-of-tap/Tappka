import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { asClaims } from "@/tests/setup/rls";
import { insertAuthUser } from "@/tests/setup/factories";
import type { PoolClient } from "pg";

async function seedProfile(
  client: PoolClient,
  opts: { name: string; email: string; role: "student" | "admin" },
) {
  const auth = await insertAuthUser(client);
  const { rows: userRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [auth.id],
  );
  // Mirrors tests/integration/feedback.int.test.ts: current_profile_id() runs as
  // invoker and selects from public.profiles, so without a verified_work_email
  // the "Verified users can view all profiles" policy makes it return NULL.
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

/** Seeds a published essay owned by `authorProfileId` and returns its id. */
async function seedEssay(client: PoolClient, authorProfileId: string) {
  const { rows: books } = await client.query(
    `insert into public.books (title_cs, author, created_by_profile_id, updated_by_profile_id, list_status, book_points)
     values ('Book', 'Author', $1, $1, 'longlist', 2) returning id`,
    [authorProfileId],
  );
  const { rows: essays } = await client.query(
    `insert into public.essays (author_profile_id, book_id, created_by_profile_id, updated_by_profile_id, published_at)
     values ($1, $2, $1, $1, now()) returning id`,
    [authorProfileId, books[0].id],
  );
  await client.query(
    `insert into public.essay_revisions (essay_id, revision_no, title, content_json, created_by_profile_id, updated_by_profile_id)
     values ($1, 1, 'Essay', '{}'::jsonb, $2, $2)`,
    [essays[0].id, authorProfileId],
  );
  return essays[0].id as string;
}

async function insertComment(
  client: PoolClient,
  opts: { essayId: string; profileId: string; body: string; parentId?: string | null },
) {
  const { rows } = await client.query(
    `insert into public.essay_comments
      (essay_id, author_profile_id, body, parent_id, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, $4, $2, $2)
     returning id`,
    [opts.essayId, opts.profileId, opts.body, opts.parentId ?? null],
  );
  return rows[0].id as string;
}

describe("essay_comments replies (parent_id)", () => {
  it("accepts a reply whose parent belongs to the same essay", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, {
        name: "Author",
        email: "reply-author@studenti.czu.cz",
        role: "student",
      });
      const replier = await seedProfile(client, {
        name: "Replier",
        email: "reply-replier@studenti.czu.cz",
        role: "student",
      });
      const essayId = await seedEssay(client, author.profileId);
      const parentId = await insertComment(client, {
        essayId,
        profileId: author.profileId,
        body: "Původní komentář",
      });

      await asClaims(client, { sub: replier.authId });
      const replyId = await insertComment(client, {
        essayId,
        profileId: replier.profileId,
        body: "Odpověď",
        parentId,
      });

      const { rows } = await client.query(
        "select parent_id from public.essay_comments where id = $1",
        [replyId],
      );
      expect(rows[0].parent_id).toBe(parentId);
    });
  });

  it("nulls out children's parent_id when the parent row is hard-deleted", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, {
        name: "Author",
        email: "fk-author@studenti.czu.cz",
        role: "student",
      });
      const essayId = await seedEssay(client, author.profileId);
      const parentId = await insertComment(client, {
        essayId,
        profileId: author.profileId,
        body: "Rodič",
      });
      const replyId = await insertComment(client, {
        essayId,
        profileId: author.profileId,
        body: "Dítě",
        parentId,
      });

      await client.query("delete from public.essay_comments where id = $1", [parentId]);

      const { rows } = await client.query(
        "select parent_id from public.essay_comments where id = $1",
        [replyId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].parent_id).toBeNull();
    });
  });

  it("rejects a parent_id that does not reference an existing comment", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, {
        name: "Author",
        email: "fk-bad@studenti.czu.cz",
        role: "student",
      });
      const essayId = await seedEssay(client, author.profileId);

      await expect(
        insertComment(client, {
          essayId,
          profileId: author.profileId,
          body: "Sirotek",
          parentId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow();
    });
  });
});

describe("essay_comments RLS UPDATE (edit + soft delete)", () => {
  it("lets the author edit their own comment but not someone else's", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, {
        name: "Author",
        email: "edit-author@studenti.czu.cz",
        role: "student",
      });
      const other = await seedProfile(client, {
        name: "Other",
        email: "edit-other@studenti.czu.cz",
        role: "student",
      });
      const essayId = await seedEssay(client, author.profileId);
      const commentId = await insertComment(client, {
        essayId,
        profileId: author.profileId,
        body: "Původní text",
      });

      await asClaims(client, { sub: other.authId });
      const byOther = await client.query(
        "update public.essay_comments set body = 'hacked', updated_by_profile_id = $2 where id = $1",
        [commentId, other.profileId],
      );
      expect(byOther.rowCount).toBe(0);

      await asClaims(client, { sub: author.authId });
      const byAuthor = await client.query(
        "update public.essay_comments set body = 'Upravený text', updated_by_profile_id = $2 where id = $1",
        [commentId, author.profileId],
      );
      expect(byAuthor.rowCount).toBe(1);

      const { rows } = await client.query(
        "select body from public.essay_comments where id = $1",
        [commentId],
      );
      expect(rows[0].body).toBe("Upravený text");
    });
  });

  it("forbids reassigning a comment to another author", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, {
        name: "Author",
        email: "reassign-author@studenti.czu.cz",
        role: "student",
      });
      const other = await seedProfile(client, {
        name: "Other",
        email: "reassign-other@studenti.czu.cz",
        role: "student",
      });
      const essayId = await seedEssay(client, author.profileId);
      const commentId = await insertComment(client, {
        essayId,
        profileId: author.profileId,
        body: "Můj komentář",
      });

      await asClaims(client, { sub: author.authId });
      // WITH CHECK (author_profile_id = current_profile_id()) rejects the new row.
      await expect(
        client.query(
          "update public.essay_comments set author_profile_id = $2 where id = $1",
          [commentId, other.profileId],
        ),
      ).rejects.toThrow();
    });
  });

  it("lets the author soft-delete their own comment but not someone else's", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, {
        name: "Author",
        email: "soft-author@studenti.czu.cz",
        role: "student",
      });
      const other = await seedProfile(client, {
        name: "Other",
        email: "soft-other@studenti.czu.cz",
        role: "student",
      });
      const essayId = await seedEssay(client, author.profileId);
      const commentId = await insertComment(client, {
        essayId,
        profileId: author.profileId,
        body: "Ke smazání",
      });

      await asClaims(client, { sub: other.authId });
      const byOther = await client.query(
        "update public.essay_comments set removed_at = now(), updated_by_profile_id = $2 where id = $1 and removed_at is null",
        [commentId, other.profileId],
      );
      expect(byOther.rowCount).toBe(0);

      await asClaims(client, { sub: author.authId });
      const byAuthor = await client.query(
        "update public.essay_comments set removed_at = now(), updated_by_profile_id = $2 where id = $1 and removed_at is null",
        [commentId, author.profileId],
      );
      expect(byAuthor.rowCount).toBe(1);

      const { rows } = await client.query(
        "select removed_at from public.essay_comments where id = $1",
        [commentId],
      );
      expect(rows[0].removed_at).not.toBeNull();
    });
  });

  it("does not let an admin soft-delete another user's comment (UPDATE policy is author-only)", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, {
        name: "Author",
        email: "admin-soft-author@studenti.czu.cz",
        role: "student",
      });
      const admin = await seedProfile(client, {
        name: "Admin",
        email: "admin-soft@rektorat.czu.cz",
        role: "admin",
      });
      const essayId = await seedEssay(client, author.profileId);
      const commentId = await insertComment(client, {
        essayId,
        profileId: author.profileId,
        body: "Sporný komentář",
      });

      await asClaims(client, { sub: admin.authId });
      const softDelete = await client.query(
        "update public.essay_comments set removed_at = now(), updated_by_profile_id = $2 where id = $1 and removed_at is null",
        [commentId, admin.profileId],
      );
      // The "Authors can update their own essay comments" policy has no is_admin()
      // branch, so the admin route to removal is a hard DELETE (below), not the
      // soft delete the API route performs.
      expect(softDelete.rowCount).toBe(0);

      const hardDelete = await client.query(
        "delete from public.essay_comments where id = $1",
        [commentId],
      );
      expect(hardDelete.rowCount).toBe(1);
    });
  });
});

describe("essay_comments RLS DELETE", () => {
  it("lets the author and admins hard-delete, but not unrelated users", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, {
        name: "Author",
        email: "del-author@studenti.czu.cz",
        role: "student",
      });
      const other = await seedProfile(client, {
        name: "Other",
        email: "del-other@studenti.czu.cz",
        role: "student",
      });
      const essayId = await seedEssay(client, author.profileId);
      const commentId = await insertComment(client, {
        essayId,
        profileId: author.profileId,
        body: "Ke smazání",
      });

      await asClaims(client, { sub: other.authId });
      const byOther = await client.query("delete from public.essay_comments where id = $1", [
        commentId,
      ]);
      expect(byOther.rowCount).toBe(0);

      await asClaims(client, { sub: author.authId });
      const byAuthor = await client.query("delete from public.essay_comments where id = $1", [
        commentId,
      ]);
      expect(byAuthor.rowCount).toBe(1);
    });
  });
});

describe("essay_comments INSERT policy", () => {
  it("forbids commenting as another profile", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, {
        name: "Author",
        email: "spoof-author@studenti.czu.cz",
        role: "student",
      });
      const other = await seedProfile(client, {
        name: "Other",
        email: "spoof-other@studenti.czu.cz",
        role: "student",
      });
      const essayId = await seedEssay(client, author.profileId);

      await asClaims(client, { sub: other.authId });
      await expect(
        client.query(
          `insert into public.essay_comments
            (essay_id, author_profile_id, body, created_by_profile_id, updated_by_profile_id)
           values ($1, $2, 'spoof', $3, $3)`,
          [essayId, author.profileId, other.profileId],
        ),
      ).rejects.toThrow();
    });
  });
});

describe("essay_comments visibility filtering", () => {
  it("excludes soft-deleted comments from the active-comment query", async () => {
    await withRollback(async (client) => {
      const author = await seedProfile(client, {
        name: "Author",
        email: "filter-author@studenti.czu.cz",
        role: "student",
      });
      const essayId = await seedEssay(client, author.profileId);
      await insertComment(client, {
        essayId,
        profileId: author.profileId,
        body: "viditelný",
      });
      const removedId = await insertComment(client, {
        essayId,
        profileId: author.profileId,
        body: "smazaný",
      });
      await client.query(
        "update public.essay_comments set removed_at = now() where id = $1",
        [removedId],
      );

      const active = await client.query(
        "select body from public.essay_comments where essay_id = $1 and removed_at is null",
        [essayId],
      );
      expect(active.rows.map((r) => r.body)).toEqual(["viditelný"]);

      // SELECT policy is `true`, so the removed row is still readable when the
      // app does not filter -- the filter is the app's job, not RLS's.
      const all = await client.query(
        "select count(*)::int as cnt from public.essay_comments where essay_id = $1",
        [essayId],
      );
      expect(all.rows[0].cnt).toBe(2);
    });
  });
});
