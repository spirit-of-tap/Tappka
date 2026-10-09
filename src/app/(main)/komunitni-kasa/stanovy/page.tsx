import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { getSessionProfile } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { StanovyView } from "@/components/komunitni-kasa/stanovy-view";

export const metadata = {
  title: "Stanovy a rejstřík spolku",
  description: "Prohlédni si stanovy, zápisy členské schůze a výpis ze spolkového rejstříku",
};

export default async function StanovyPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");

  return (
    <PageShell>
      <PageHeader
        title="Stanovy a rejstřík"
        description="Prohlédni si stanovy, zápisy členské schůze a výpis ze spolkového rejstříku"
        back={{ href: "/komunitni-kasa", label: "Zpět na komunitní kasu" }}
        action={
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a
              href="https://or.justice.cz/ias/ui/rejstrik-firma.vysledky?subjektId=1276393&typ=PLATNY"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4" aria-hidden />
              <span>Obchodní rejstřík</span>
            </a>
          </Button>
        }
      />
      <StanovyView />
    </PageShell>
  );
}
