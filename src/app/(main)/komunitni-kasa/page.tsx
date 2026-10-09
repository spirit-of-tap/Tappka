import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/session";
import { PageShell } from "@/components/ui/page-shell";
import { KomunitniKasaView } from "@/components/komunitni-kasa/komunitni-kasa-view";

export const metadata = {
  title: "Komunitní kasa",
  description: "Sleduj příjmy, výdaje a zůstatek komunitní kasy",
};

export default async function KomunitniKasaPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");

  return (
    <PageShell>
      <KomunitniKasaView />
    </PageShell>
  );
}
