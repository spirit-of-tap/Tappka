import { checkKasaAccess } from "@/lib/komunitni-kasa/access";
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon";
import { StanovyView } from "@/components/komunitni-kasa/stanovy-view";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

const DESCRIPTION = "Úplné znění schválené členskou schůzí 3. 6. 2026";

export const metadata = {
  title: "Stanovy · Komunitní kasa",
  description: DESCRIPTION,
};

export default async function KasaStanovyPage() {
  if (!(await checkKasaAccess())) return <FeatureComingSoon featureName="Komunitní kasa" />;

  return (
    <PageShell>
      <div className="mx-auto max-w-prose space-y-8">
        <PageHeader
          title="Stanovy"
          description={DESCRIPTION}
          back={{ href: "/komunitni-kasa/dokumenty", label: "Zpět na dokumenty" }}
        />
        <StanovyView />
      </div>
    </PageShell>
  );
}
