import { checkKasaAccess } from "@/lib/komunitni-kasa/access";
import { SMERNICE_TITLE } from "@/lib/komunitni-kasa/smernice-data";
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon";
import { SmerniceView } from "@/components/komunitni-kasa/smernice-view";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

const DESCRIPTION = "Kdo a jak rozhoduje o výdajích z komunitní kasy";

export const metadata = {
  title: `${SMERNICE_TITLE} · Komunitní kasa`,
  description: DESCRIPTION,
};

export default async function KasaSmernicePage() {
  if (!(await checkKasaAccess())) return <FeatureComingSoon featureName="Komunitní kasa" />;

  return (
    <PageShell>
      <div className="mx-auto max-w-prose space-y-8">
        <PageHeader
          title={SMERNICE_TITLE}
          description={DESCRIPTION}
          back={{ href: "/komunitni-kasa/dokumenty", label: "Zpět na dokumenty" }}
        />
        <SmerniceView />
      </div>
    </PageShell>
  );
}
