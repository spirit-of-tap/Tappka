import { checkKasaAccess } from "@/lib/komunitni-kasa/access";
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon";
import { DocumentList } from "@/components/komunitni-kasa/document-list";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

const DESCRIPTION = "Stanovy, pravidla pro výdaje a úřední listiny spolku Spirit of TAP";

export const metadata = {
  title: "Dokumenty spolku · Komunitní kasa",
  description: DESCRIPTION,
};

export default async function KasaDokumentyPage() {
  if (!(await checkKasaAccess())) return <FeatureComingSoon featureName="Komunitní kasa" />;

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          title="Dokumenty spolku"
          description={DESCRIPTION}
          back={{ href: "/komunitni-kasa", label: "Zpět na komunitní kasu" }}
        />
        <DocumentList />
      </div>
    </PageShell>
  );
}
