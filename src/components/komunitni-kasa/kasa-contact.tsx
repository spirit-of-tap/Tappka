import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { KASA_CONTACT } from "@/lib/komunitni-kasa/brand/constants";
import { fetchKasaContact, type KasaContactInfo } from "@/lib/komunitni-kasa/contact";
import { createClient } from "@/lib/supabase/server";
import { StorageAvatar } from "@/components/storage/storage-avatar";

const PROFILE_HREF = `/komunita/profil/${KASA_CONTACT.profileId}`;

async function loadContact(): Promise<KasaContactInfo> {
  try {
    return await fetchKasaContact(await createClient());
  } catch {
    return { name: KASA_CONTACT.fallbackName, picture: null };
  }
}

/** Kontaktní osoba pro dotazy ke kase. */
export async function KasaContact() {
  const contact = await loadContact();
  return (
    <section aria-labelledby="kontakt" className="space-y-3 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border/60">
      <h2 id="kontakt" className="font-heading text-base font-semibold">
        S dotazy pomůže
      </h2>
      <Link href={PROFILE_HREF} className="group flex items-center gap-3 rounded-lg focus-ring">
        <StorageAvatar storageKey={contact.picture} name={contact.name} size="lg" className="size-12" />
        <div className="min-w-0">
          <p className="font-heading text-base font-semibold group-hover:underline">{contact.name}</p>
          <p className="text-sm text-muted-foreground">S dotazy ke kase se obrať na Julii.</p>
        </div>
        <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </section>
  );
}
