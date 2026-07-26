import type { Tables } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import type { TransferPlan } from "./preflight";
import { chunk, deleteRows, patchRows, selectAll } from "./rest";

export const DELETE_CHUNK = 100;

export function inFilter(column: string, ids: readonly string[]): string {
  if (ids.length === 0) {
    throw new Error(`Refusing to build an in.() filter for ${column} from an empty id list`);
  }
  const encoded = ids.map((id) => (id.includes(",") ? `"${id}"` : id)).join(",");
  return `${column}=in.(${encoded})`;
}

async function deleteByIds(
  target: Endpoint,
  table: string,
  column: string,
  ids: readonly string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  for (const batch of chunk(ids, DELETE_CHUNK)) {
    await deleteRows(target, table, inFilter(column, batch));
  }
  return ids.length;
}

/**
 * Deletes only what this transfer inserts, identified by source ids. Never
 * touches pre-existing target profiles or any team. Storage objects are left
 * alone by design: paths are deterministic and orphans are harmless.
 */
export async function rollbackTransfer(
  source: Endpoint,
  target: Endpoint,
  plan: TransferPlan,
): Promise<void> {
  const [essays, comments, books, tags] = await Promise.all([
    selectAll<Pick<Tables<"essays">, "id">>(source, "essays", "id"),
    selectAll<Pick<Tables<"essay_comments">, "id">>(source, "essay_comments", "id"),
    selectAll<Pick<Tables<"books">, "id">>(source, "books", "id"),
    selectAll<Pick<Tables<"tags">, "id">>(source, "tags", "id"),
  ]);

  const essayIds = essays.map((row) => row.id);

  // Child rows first: essay_comments and essay_revisions reference essays.
  console.log(`  essay_comments: ${await deleteByIds(target, "essay_comments", "id", comments.map((r) => r.id))}`);
  console.log(`  essay_revisions: ${await deleteByIds(target, "essay_revisions", "essay_id", essayIds)}`);
  console.log(`  essays: ${await deleteByIds(target, "essays", "id", essayIds)}`);

  const bookIds = books.map((row) => row.id);
  console.log(`  book_tags: ${await deleteByIds(target, "book_tags", "book_id", bookIds)}`);
  console.log(`  tags: ${await deleteByIds(target, "tags", "id", tags.map((r) => r.id))}`);
  console.log(`  books: ${await deleteByIds(target, "books", "id", bookIds)}`);

  // Revert the team_id patch on reused profiles, but only where it still holds
  // the value this transfer wrote, so a hand-set team is never clobbered.
  for (const collision of plan.profileMap.collisions) {
    const sourceProfile = plan.sourceProfiles.find((p) => p.id === collision.sourceId);
    if (sourceProfile?.team_id == null) continue;
    await patchRows(
      target,
      "profiles",
      `id=eq.${collision.targetId}&team_id=eq.${sourceProfile.team_id}`,
      { team_id: null },
    );
  }

  const insertedProfileIds = plan.sourceProfiles
    .filter((profile) => plan.profileMap.insertIds.has(profile.id))
    .map((profile) => profile.id);
  console.log(`  profiles: ${await deleteByIds(target, "profiles", "id", insertedProfileIds)}`);

  console.log("  teams: untouched by design");
  console.log("  storage: untouched by design (orphaned objects are harmless)");
}
