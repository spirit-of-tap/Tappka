import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/session";
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access";

/** Společná brána všech stránek kasy (feature `komunitniKasa`). */
export async function checkKasaAccess(): Promise<boolean> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");
  return canAccessFeature(
    {
      role: profile.role,
      beta_access_granted_at: profile.beta_access_granted_at,
      beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
    },
    "komunitniKasa",
  );
}
