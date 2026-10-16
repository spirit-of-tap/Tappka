import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/session";
import { PageShell } from "@/components/ui/page-shell";
import { KomunitniKasaView } from "@/components/komunitni-kasa/komunitni-kasa-view";
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon";
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access";

export const metadata = {
  title: "Komunitní kasa",
  description: "Sleduj příjmy, výdaje a zůstatek komunitní kasy",
};

export default async function KomunitniKasaPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");
  if (
    !canAccessFeature(
      {
        role: profile.role,
        beta_access_granted_at: profile.beta_access_granted_at,
        beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
      },
      "komunitniKasa",
    )
  ) {
    return <FeatureComingSoon featureName="Komunitní kasa" />;
  }

  return (
    <PageShell>
      <KomunitniKasaView />
    </PageShell>
  );
}
