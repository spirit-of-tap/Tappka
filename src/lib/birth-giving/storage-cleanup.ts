import { createAdminClient } from "@/lib/supabase/admin";
import { deleteFile } from "@/lib/storage/service";

const CLEANUP_GRACE_PERIOD = "1 hour";
const CLEANUP_STALE_AFTER = "15 minutes";
const CLEANUP_BATCH_SIZE = 100;

export interface BirthGivingStorageCleanupResult {
  claimed: number;
  deleted: number;
  failed: number;
}

export async function cleanupBirthGivingStorage(): Promise<BirthGivingStorageCleanupResult> {
  const admin = createAdminClient();
  const { data: claims, error } = await admin.rpc("birth_giving_claim_storage_cleanup", {
    p_grace_period: CLEANUP_GRACE_PERIOD,
    p_limit: CLEANUP_BATCH_SIZE,
    p_stale_after: CLEANUP_STALE_AFTER,
  });
  if (error) throw new Error(`Failed to claim Birth Giving storage cleanup: ${error.message}`);

  let deleted = 0;
  let failed = 0;
  for (const claim of claims ?? []) {
    try {
      await deleteFile("documents", claim.storage_path);
      const { data: finalized, error: finalizeError } = await admin.rpc("birth_giving_finalize_storage_cleanup", {
        p_claim_id: claim.claim_id,
        p_storage_path: claim.storage_path,
      });
      if (finalizeError || !finalized) throw new Error(finalizeError?.message ?? "Cleanup claim is no longer current");
      deleted += 1;
    } catch {
      failed += 1;
      await admin.rpc("birth_giving_release_storage_cleanup_claim", {
        p_claim_id: claim.claim_id,
        p_storage_path: claim.storage_path,
      });
    }
  }

  return { claimed: claims?.length ?? 0, deleted, failed };
}
