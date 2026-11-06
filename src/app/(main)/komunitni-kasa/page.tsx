import Link from "next/link";
import { ArrowRight, FileText, Palette } from "lucide-react";

import { checkKasaAccess } from "@/lib/komunitni-kasa/access";
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon";
import { DecisionExplainer } from "@/components/komunitni-kasa/decision-explainer";
import { KasaContact } from "@/components/komunitni-kasa/kasa-contact";
import { KasaMark } from "@/components/komunitni-kasa/kasa-mark";
import { KasaOverview } from "@/components/komunitni-kasa/kasa-overview";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

const DESCRIPTION = "Společné peníze všech družstev, příspěvek 190 Kč měsíčně na osobu";

export const metadata = {
  title: "Komunitní kasa",
  description: DESCRIPTION,
};

const FOOTER_LINKS = [
  {
    href: "/komunitni-kasa/znacka",
    title: "Značka a materiály",
    description: "Logo, samolepky a plakáty ke stažení",
    icon: Palette,
  },
  {
    href: "/komunitni-kasa/dokumenty",
    title: "Dokumenty spolku",
    description: "Stanovy, směrnice a rejstřík",
    icon: FileText,
  },
] as const;

export default async function KomunitniKasaPage() {
  if (!(await checkKasaAccess())) return <FeatureComingSoon featureName="Komunitní kasa" />;

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl space-y-12">
        <PageHeader title="Komunitní kasa" description={DESCRIPTION} icon={<KasaMark className="size-10" />} />
        <KasaOverview />
        <DecisionExplainer />
        <KasaContact />
        <nav aria-label="Další stránky kasy" className="grid gap-2 border-t pt-8 sm:grid-cols-2">
          {FOOTER_LINKS.map(({ href, title, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-accent focus-ring -mx-3 sm:mx-0"
            >
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </nav>
      </div>
    </PageShell>
  );
}
