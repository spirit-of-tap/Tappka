import type { Tables, TablesInsert } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import type { TransferPlan } from "./preflight";
import { remapOptionalProfileId, remapProfileId } from "./profile-map";
import { chunk, insertRows, selectAll } from "./rest";

export const INSERT_CHUNK = 200;

export interface CatalogStageReport {
  readonly books: number;
  readonly tags: number;
  readonly bookTags: number;
}

export function buildBookInsertRows(
  books: readonly Tables<"books">[],
  plan: TransferPlan,
): TablesInsert<"books">[] {
  return books.map((book) => ({
    ...book,
    created_by_profile_id: remapProfileId(plan.profileMap, book.created_by_profile_id),
    updated_by_profile_id: remapProfileId(plan.profileMap, book.updated_by_profile_id),
    status_changed_by_profile_id: remapOptionalProfileId(
      plan.profileMap,
      book.status_changed_by_profile_id,
    ),
  }));
}

async function insertChunked(
  target: Endpoint,
  table: string,
  rows: readonly unknown[],
  onConflict?: string,
): Promise<number> {
  for (const batch of chunk(rows, INSERT_CHUNK)) {
    await insertRows(target, table, batch, onConflict);
  }
  return rows.length;
}

export async function transferCatalog(
  source: Endpoint,
  target: Endpoint,
  plan: TransferPlan,
): Promise<CatalogStageReport> {
  const books = await selectAll<Tables<"books">>(source, "books");
  const bookCount = await insertChunked(target, "books", buildBookInsertRows(books, plan));

  const tags = await selectAll<Tables<"tags">>(source, "tags");
  const tagCount = await insertChunked(target, "tags", tags);

  const bookTags = await selectAll<Tables<"book_tags">>(source, "book_tags");
  const bookTagCount = await insertChunked(
    target,
    "book_tags",
    bookTags,
    "book_id,tag_id",
  );

  return { books: bookCount, tags: tagCount, bookTags: bookTagCount };
}
