import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { KASA_CONTACT } from "./brand/constants";

export interface KasaContactInfo {
  name: string;
  picture: string | null;
}

const FALLBACK: KasaContactInfo = { name: KASA_CONTACT.fallbackName, picture: null };

/**
 * Jméno a fotka kontaktní osoby kasy. Chybějící profil (třeba v lokální DB)
 * není chyba — vrátí se statické jméno.
 */
export async function fetchKasaContact(supabase: SupabaseClient<Database>): Promise<KasaContactInfo> {
  const { data, error } = await supabase
    .from("profiles")
    .select("name, picture")
    .eq("id", KASA_CONTACT.profileId)
    .is("access_removed_at", null)
    .maybeSingle();
  if (error || !data?.name) return FALLBACK;
  return { name: data.name, picture: data.picture ?? null };
}
