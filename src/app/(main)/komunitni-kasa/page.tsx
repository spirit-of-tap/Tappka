import { checkKasaAccess } from "@/lib/komunitni-kasa/access";
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon";
import { KasaContact } from "@/components/komunitni-kasa/kasa-contact";
import { KasaQuickLinks } from "@/components/komunitni-kasa/kasa-quick-links";
import { KasaMark } from "@/components/komunitni-kasa/kasa-mark";
import { KasaOverview } from "@/components/komunitni-kasa/kasa-overview";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

const DESCRIPTION = "Společné peníze všech družstev";

export const metadata = {
  title: "Komunitní kasa",
  description: DESCRIPTION,
};

export default async function KomunitniKasaPage() {
  if (!(await checkKasaAccess())) return <FeatureComingSoon featureName="Komunitní kasa" />;

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageHeader title="Komunitní kasa" description={DESCRIPTION} icon={<KasaMark className="size-10" />} />
        <KasaOverview
          aside={
            <>
              <KasaContact />
              <KasaQuickLinks />
            </>
          }
        />
      </div>
    </PageShell>
  );
}
