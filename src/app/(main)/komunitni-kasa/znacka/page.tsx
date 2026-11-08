import { checkKasaAccess } from "@/lib/komunitni-kasa/access";
import { KASA_MEANING, KASA_PRINT_NOTE, KASA_WHY_LABEL } from "@/lib/komunitni-kasa/brand/guidelines";
import { SMERNICE_IS_DRAFT } from "@/lib/komunitni-kasa/smernice-data";
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon";
import { AssetGallery } from "@/components/komunitni-kasa/brand/asset-gallery";
import { KasaFontFaces } from "@/components/komunitni-kasa/brand/kasa-font-faces";
import { OfficialTexts } from "@/components/komunitni-kasa/brand/official-texts";
import { RolePosterTool } from "@/components/komunitni-kasa/brand/role-poster-tool";
import { StickerSheetTool } from "@/components/komunitni-kasa/brand/sticker-sheet-tool";
import { UsageRules } from "@/components/komunitni-kasa/brand/usage-rules";
import { KasaMark } from "@/components/komunitni-kasa/kasa-mark";
import { KasaSection } from "@/components/komunitni-kasa/kasa-section";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

const DESCRIPTION = "Značka kasy ke stažení, generátor plakátů a samolepek a pravidla použití";

export const metadata = {
  title: "Značka a materiály · Komunitní kasa",
  description: DESCRIPTION,
};

export default async function KasaZnackaPage() {
  if (!(await checkKasaAccess())) return <FeatureComingSoon featureName="Komunitní kasa" />;

  return (
    <PageShell>
      <KasaFontFaces />
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="space-y-4">
          <PageHeader
            title="Značka a materiály"
            description={DESCRIPTION}
            back={{ href: "/komunitni-kasa", label: "Zpět na komunitní kasu" }}
            icon={<KasaMark className="size-10" />}
          />
          <p className="max-w-prose text-sm text-muted-foreground">
            {KASA_WHY_LABEL} Označení vyžaduje čl. 5 odst. 3 směrnice o výdajích
            {SMERNICE_IS_DRAFT ? " (zatím návrh)" : ""}.
          </p>
        </div>

        <KasaSection id="ke-stazeni" title="Ke stažení">
          <AssetGallery />
        </KasaSection>

        <KasaSection id="plakat-role" title="Plakát komunitní role">
          <RolePosterTool />
        </KasaSection>

        <KasaSection id="arch-samolepek" title="Arch samolepek">
          <StickerSheetTool />
        </KasaSection>

        <KasaSection id="jak-pouzivat" title="Jak značku používat">
          <UsageRules />
        </KasaSection>

        <KasaSection id="texty" title="Texty">
          <p className="text-sm text-muted-foreground">Kde není místo na značku, stačí věta. Používej ji přesně v tomto znění.</p>
          <OfficialTexts />
        </KasaSection>

        <KasaSection id="vyznam" title="Co značka znamená">
          <dl className="grid gap-5 sm:grid-cols-3">
            {KASA_MEANING.map((item) => (
              <div key={item.title} className="space-y-1">
                <dt className="text-sm font-semibold">{item.title}</dt>
                <dd className="text-sm text-muted-foreground">{item.text}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t pt-5 text-xs text-muted-foreground">{KASA_PRINT_NOTE}</p>
        </KasaSection>
      </div>
    </PageShell>
  );
}
