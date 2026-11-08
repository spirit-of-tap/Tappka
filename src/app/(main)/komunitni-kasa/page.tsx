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

const QUICK_LINKS = [
  {
    href: "/komunitni-kasa/znacka",
    title: "Značka a materiály",
    description: "Logo, samolepky a plakáty ke stažení a jak je používat",
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
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader title="Komunitní kasa" description={DESCRIPTION} icon={<KasaMark className="size-10" />} />
        <nav aria-label="Materiály a dokumenty kasy" className="grid gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map(({ href, title, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-accent focus-ring"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-base font-semibold">{title}</span>
                <span className="block text-sm text-muted-foreground">{description}</span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
          ))}
        </nav>
        <KasaOverview />
        <DecisionExplainer />
        <KasaContact />
      </div>
    </PageShell>
  );
}
