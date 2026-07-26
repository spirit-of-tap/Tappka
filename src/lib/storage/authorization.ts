import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { StorageContext } from "./types";

type AuthProfile = {
  id: string;
  team_id: string | null;
  role: string | null;
};

export function authorizeAction(
  context: StorageContext,
  entityId: string,
  profile: AuthProfile,
): string | null {
  if (context === "profile") {
    if (entityId !== profile.id) {
      return "Nemáš oprávnění provést tuto akci";
    }
    return null;
  }

  if (context === "team") {
    if (profile.team_id !== entityId) {
      return "Nejsi členem tohoto týmu";
    }
    if (profile.role !== "admin") {
      return "Pouze administrátoři mohou provést tuto akci";
    }
    return null;
  }

  return "Neplatný kontext";
}

export async function getCurrentPictureKey(
  supabase: SupabaseClient<Database>,
  context: StorageContext,
  entityId: string,
): Promise<string | null> {
  if (context === "profile") {
    const { data } = await supabase
      .from("profiles")
      .select("picture")
      .eq("id", entityId)
      .single();
    return data?.picture ?? null;
  }

  if (context === "team") {
    const { data } = await supabase
      .from("teams")
      .select("picture")
      .eq("id", entityId)
      .single();
    return data?.picture ?? null;
  }

  return null;
}

export async function clearPictureRef(
  supabase: SupabaseClient<Database>,
  context: StorageContext,
  entityId: string,
): Promise<{ error?: string }> {
  if (context === "profile") {
    const { error } = await supabase
      .from("profiles")
      .update({ picture: null })
      .eq("id", entityId);
    if (error) return { error: "Nepodařilo se odstranit obrázek z databáze" };
    return {};
  }

  if (context === "team") {
    const { error } = await supabase
      .from("teams")
      .update({ picture: null })
      .eq("id", entityId);
    if (error) return { error: "Nepodařilo se odstranit obrázek z databáze" };
    return {};
  }

  return { error: "Neplatný kontext" };
}

export async function setPictureRef(
  supabase: SupabaseClient<Database>,
  context: StorageContext,
  entityId: string,
  key: string,
  select?: boolean,
): Promise<{ data?: unknown; error?: string }> {
  if (context === "profile") {
    const query = supabase.from("profiles").update({ picture: key }).eq("id", entityId);
    if (select) {
      const { data, error } = await query.select();
      if (error) return { error: "Nepodařilo se aktualizovat profilový obrázek" };
      return { data };
    }
    const { error } = await query;
    if (error) return { error: "Nepodařilo se aktualizovat profilový obrázek" };
    return {};
  }

  if (context === "team") {
    const { error } = await supabase
      .from("teams")
      .update({ picture: key })
      .eq("id", entityId);
    if (error) return { error: "Nepodařilo se aktualizovat obrázek týmu" };
    return {};
  }

  return { error: "Neplatný kontext" };
}
