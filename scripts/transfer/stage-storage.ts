import type { Tables } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import { collectLocalObjectPaths } from "./content-rewrite";
import {
  downloadObject,
  headObject,
  mapWithConcurrency,
  uploadObject,
} from "./storage";

export const STORAGE_CONCURRENCY = 8;

const PROGRESS_INTERVAL = 100;

export interface StorageStageReport {
  readonly referenced: number;
  readonly alreadyPresent: number;
  readonly uploaded: number;
}

export function collectAllObjectPaths(
  revisions: readonly Pick<Tables<"essay_revisions">, "content_json">[],
  localPrefix: string,
): string[] {
  const paths = new Set<string>();
  for (const revision of revisions) {
    for (const path of collectLocalObjectPaths(revision.content_json, localPrefix)) {
      paths.add(path);
    }
  }
  return [...paths];
}

/**
 * Ensures every REFERENCED object exists in the target. Driven by referenced
 * paths rather than a bucket listing, so an unreferenced source object is
 * never uploaded.
 */
export async function syncStorage(
  source: Endpoint,
  target: Endpoint,
  paths: readonly string[],
): Promise<StorageStageReport> {
  let alreadyPresent = 0;
  let uploaded = 0;
  let processed = 0;

  await mapWithConcurrency(paths, STORAGE_CONCURRENCY, async (path) => {
    const [targetHead, sourceHead] = await Promise.all([
      headObject(target, path),
      headObject(source, path),
    ]);

    if (!sourceHead.exists) {
      throw new Error(`Source object missing from local storage: ${path}`);
    }

    if (targetHead.exists && targetHead.size === sourceHead.size) {
      alreadyPresent += 1;
    } else {
      const object = await downloadObject(source, path);
      await uploadObject(target, path, object.bytes, object.contentType);
      uploaded += 1;
    }

    processed += 1;
    if (processed % PROGRESS_INTERVAL === 0) {
      process.stdout.write(`\r  ${processed}/${paths.length} (${uploaded} uploaded)`);
    }
  });

  process.stdout.write(`\r  ${paths.length}/${paths.length} (${uploaded} uploaded)\n`);
  return { referenced: paths.length, alreadyPresent, uploaded };
}
