import type { Tables, TablesInsert } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import { rewriteLocalStorageUrls } from "./content-rewrite";
import type { TransferPlan } from "./preflight";
import { remapOptionalProfileId, remapProfileId } from "./profile-map";
import { chunk, insertRows, selectAll } from "./rest";
import { INSERT_CHUNK } from "./stage-catalog";

const REVISION_ON_CONFLICT = "essay_id,revision_no";

export interface EssayStageReport {
  readonly essays: number;
  readonly revisions: number;
  readonly rewrittenUrls: number;
  readonly comments: number;
}

export function buildEssayInsertRows(
  essays: readonly Tables<"essays">[],
  plan: TransferPlan,
): TablesInsert<"essays">[] {
  return essays.map((essay) => ({
    ...essay,
    author_profile_id: remapProfileId(plan.profileMap, essay.author_profile_id),
    pinned_by_profile_id: remapOptionalProfileId(
      plan.profileMap,
      essay.pinned_by_profile_id,
    ),
    created_by_profile_id: remapProfileId(plan.profileMap, essay.created_by_profile_id),
    updated_by_profile_id: remapProfileId(plan.profileMap, essay.updated_by_profile_id),
  }));
}

export function buildRevisionInsertRows(
  revisions: readonly Tables<"essay_revisions">[],
  plan: TransferPlan,
  fromPrefix: string,
  toPrefix: string,
): { rows: TablesInsert<"essay_revisions">[]; rewritten: number } {
  let rewritten = 0;

  const rows = revisions.map((revision) => {
    const result = rewriteLocalStorageUrls(revision.content_json, fromPrefix, toPrefix);
    rewritten += result.rewritten;

    return {
      ...revision,
      content_json: result.value,
      created_by_profile_id: remapProfileId(plan.profileMap, revision.created_by_profile_id),
      updated_by_profile_id: remapProfileId(plan.profileMap, revision.updated_by_profile_id),
    };
  });

  return { rows, rewritten };
}

export function buildCommentInsertRows(
  comments: readonly Tables<"essay_comments">[],
  plan: TransferPlan,
): TablesInsert<"essay_comments">[] {
  return comments.map((comment) => ({
    ...comment,
    author_profile_id: remapProfileId(plan.profileMap, comment.author_profile_id),
    created_by_profile_id: remapProfileId(plan.profileMap, comment.created_by_profile_id),
    updated_by_profile_id: remapProfileId(plan.profileMap, comment.updated_by_profile_id),
  }));
}

export async function transferEssays(
  source: Endpoint,
  target: Endpoint,
  plan: TransferPlan,
  revisions: readonly Tables<"essay_revisions">[],
): Promise<EssayStageReport> {
  const essays = await selectAll<Tables<"essays">>(source, "essays");
  const essayRows = buildEssayInsertRows(essays, plan);
  for (const batch of chunk(essayRows, INSERT_CHUNK)) {
    await insertRows(target, "essays", batch);
  }

  const revisionResult = buildRevisionInsertRows(
    revisions,
    plan,
    source.publicImagePrefix,
    target.publicImagePrefix,
  );
  for (const batch of chunk(revisionResult.rows, INSERT_CHUNK)) {
    await insertRows(target, "essay_revisions", batch, REVISION_ON_CONFLICT);
  }

  const comments = await selectAll<Tables<"essay_comments">>(source, "essay_comments");
  const commentRows = buildCommentInsertRows(comments, plan);
  for (const batch of chunk(commentRows, INSERT_CHUNK)) {
    await insertRows(target, "essay_comments", batch);
  }

  return {
    essays: essayRows.length,
    revisions: revisionResult.rows.length,
    rewrittenUrls: revisionResult.rewritten,
    comments: commentRows.length,
  };
}
