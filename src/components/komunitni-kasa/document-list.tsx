import Link from "next/link";
import { ArrowRight, BookOpen, ExternalLink, FileSignature, Landmark, Library, Scale, type LucideIcon } from "lucide-react";

import { SBIRKA_LISTIN_DOKUMENTY, SPOLOK_REJSTRIK_INFO } from "@/lib/komunitni-kasa/stanovy-data";
import { SMERNICE_IS_DRAFT, SMERNICE_TITLE } from "@/lib/komunitni-kasa/smernice-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ZAPIS_URL = SBIRKA_LISTIN_DOKUMENTY.find((doc) => doc.id === "sl2")?.url ?? SPOLOK_REJSTRIK_INFO.links.sbirkaListin;

interface DocumentRow {
  title: string;
  description: string;
  status: string;
  icon: LucideIcon;
  draft?: boolean;
  action: { label: string; srLabel: string; href: string; external: boolean };
}

const DOCUMENTS: DocumentRow[] = [
  {
    title: "Stanovy",
    description: "Pravidla spolku: účel, členství, orgány a hospodaření.",
    status: "Platné od 3. 6. 2026",
    icon: BookOpen,
    action: { label: "Číst", srLabel: "Číst stanovy", href: "/komunitni-kasa/dokumenty/stanovy", external: false },
  },
  {
    title: SMERNICE_TITLE,
    description: "Kdo a jak rozhoduje o výdajích z kasy.",
    status: SMERNICE_IS_DRAFT ? "Čeká na schválení družstvy" : "Platná",
    icon: Scale,
    draft: SMERNICE_IS_DRAFT,
    action: { label: "Číst", srLabel: "Číst směrnici", href: "/komunitni-kasa/dokumenty/smernice", external: false },
  },
  {
    title: "Zápis z členské schůze 3. 6. 2026",
    description: "Změna sídla, nové stanovy, přijetí nového družstva a volba předsednictví.",
    status: "Ve Sbírce listin",
    icon: FileSignature,
    action: { label: "Otevřít", srLabel: "Otevřít zápis na justice.cz", href: ZAPIS_URL, external: true },
  },
  {
    title: "Výpis ze spolkového rejstříku",
    description: "Aktuální úřední údaje o spolku.",
    status: "justice.cz",
    icon: Landmark,
    action: {
      label: "Otevřít",
      srLabel: "Otevřít výpis na justice.cz",
      href: SPOLOK_REJSTRIK_INFO.links.rejstrik,
      external: true,
    },
  },
  {
    title: "Sbírka listin",
    description: "Všechny listiny založené u rejstříkového soudu.",
    status: "justice.cz",
    icon: Library,
    action: {
      label: "Otevřít",
      srLabel: "Otevřít Sbírku listin na justice.cz",
      href: SPOLOK_REJSTRIK_INFO.links.sbirkaListin,
      external: true,
    },
  },
];

function RowAction({ action }: { action: DocumentRow["action"] }) {
  const content = (
    <>
      <span aria-hidden>{action.label}</span>
      <span className="sr-only">{action.srLabel}</span>
      {action.external ? <ExternalLink className="size-4" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
    </>
  );
  return (
    <Button asChild variant={action.external ? "ghost" : "outline"} size="sm" className="shrink-0 gap-1.5">
      {action.external ? (
        <a href={action.href} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      ) : (
        <Link href={action.href}>{content}</Link>
      )}
    </Button>
  );
}

/** Přehled dokumentů spolku — stanovy a směrnice v aplikaci, úřední listiny na justice.cz. */
export function DocumentList() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {SPOLOK_REJSTRIK_INFO.nazev} · IČO {SPOLOK_REJSTRIK_INFO.formattedIco} · sp. zn.{" "}
        {SPOLOK_REJSTRIK_INFO.spisovaZnacka}
      </p>
      <ul className="divide-y border-y">
        {DOCUMENTS.map(({ title, description, status, icon: Icon, draft, action }) => (
          <li key={title} className="flex items-center gap-4 py-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">{title}</h2>
                {draft ? (
                  <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning-strong">
                    Návrh
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
              <p className="text-xs text-muted-foreground">{status}</p>
            </div>
            <RowAction action={action} />
          </li>
        ))}
      </ul>
    </div>
  );
}
