import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { KASA_CONTACT } from "@/lib/komunitni-kasa/brand/constants";
import { fetchKasaContact, type KasaContactInfo } from "@/lib/komunitni-kasa/contact";
import { createClient } from "@/lib/supabase/server";
import { StorageAvatar } from "@/components/storage/storage-avatar";
import { KasaSection } from "./kasa-section";

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
    <KasaSection id="kontakt" title="Kontakt">
      <Link
        href={PROFILE_HREF}
        className="group flex items-center gap-4 rounded-lg focus-ring"
      >
        <StorageAvatar storageKey={contact.picture} name={contact.name} size="lg" className="size-14" />
        <div className="min-w-0">
          <p className="font-heading text-base font-semibold group-hover:underline">{contact.name}</p>
          <p className="text-sm text-muted-foreground">S dotazy ke kase se obrať na Julii.</p>
        </div>
        <ArrowRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
      </Link>
    </KasaSection>
  );
}
