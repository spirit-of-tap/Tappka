import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/session";
import { getHubModules } from "@/lib/navigation";
import { ModuleGrid } from "@/components/navigation/module-grid";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import type { BetaCohort } from "@/lib/feature-access";

export const metadata = {
  title: "Moduly | Tappka",
  description: "Všechny části Tappky na jednom místě",
};

export default async function ModulyPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");

  const accessProfile = {
    role: profile.role,
    beta_access_granted_at: profile.beta_access_granted_at,
    beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
  };

  return (
    <PageShell>
      <PageHeader
        title="Moduly"
        description="Všechny části Tappky na jednom místě"
      />
      <ModuleGrid modules={getHubModules(accessProfile)} profileId={profile.id} />
    </PageShell>
  );
}
