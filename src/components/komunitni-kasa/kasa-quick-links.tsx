import Link from "next/link";
import { ArrowRight, FileText, Palette } from "lucide-react";

const QUICK_LINKS = [
  { href: "/komunitni-kasa/znacka", title: "Značka a materiály", icon: Palette },
  { href: "/komunitni-kasa/dokumenty", title: "Dokumenty spolku", icon: FileText },
] as const;

/** Odkazy na značku a dokumenty spolku pro družstva. */
export function KasaQuickLinks() {
  return (
    <section aria-labelledby="pro-druzstva" className="space-y-3 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border/60">
      <h2 id="pro-druzstva" className="font-heading text-base font-semibold">
        Pro družstva
      </h2>
      <ul className="space-y-1">
        {QUICK_LINKS.map(({ href, title, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="group focus-ring -mx-2 flex items-center gap-3 rounded-xl p-2 text-sm font-medium hover:bg-accent"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-chart-2/15 text-chart-2-strong">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">{title}</span>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
