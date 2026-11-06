import { checkKasaAccess } from "@/lib/komunitni-kasa/access";
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon";
import { TransactionsView } from "@/components/komunitni-kasa/transactions-view";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

const DESCRIPTION = "Každá platba na transparentním účtu kasy, od nejnovější";

export const metadata = {
  title: "Všechny pohyby · Komunitní kasa",
  description: DESCRIPTION,
};

export default async function KasaPohybyPage() {
  if (!(await checkKasaAccess())) return <FeatureComingSoon featureName="Komunitní kasa" />;

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <PageHeader
          title="Všechny pohyby"
          description={DESCRIPTION}
          back={{ href: "/komunitni-kasa", label: "Zpět na komunitní kasu" }}
        />
        <TransactionsView />
      </div>
    </PageShell>
  );
}
