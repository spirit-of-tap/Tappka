import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getCurrentUserProfile } from "@/lib/auth-helpers";
import {
  mapBirthGivingPostgresError,
  type BirthGivingPostgresError,
} from "@/lib/birth-giving/api";
import { getBirthGivingEvent } from "@/lib/birth-giving/queries";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

interface BirthGivingApiContext {
  supabase: SupabaseClient<Database>;
}

interface BirthGivingApiGateFailure {
  response: NextResponse;
}

export async function requireBirthGivingApiContext(): Promise<
  BirthGivingApiContext | BirthGivingApiGateFailure
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Neautorizováno" }, { status: 401 }) };
  }

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) {
    return { response: NextResponse.json({ error: "Profil nenalezen" }, { status: 403 }) };
  }
  if (!profile.beta_access_granted_at) {
    return {
      response: NextResponse.json(
        { error: "Tato funkce vyžaduje beta přístup" },
        { status: 403 },
      ),
    };
  }

  return { supabase };
}

export function isBirthGivingApiGateFailure(
  result: BirthGivingApiContext | BirthGivingApiGateFailure,
): result is BirthGivingApiGateFailure {
  return "response" in result;
}

export function invalidPayloadResponse(): NextResponse {
  return NextResponse.json({ error: "Neplatná data požadavku" }, { status: 400 });
}

export async function birthGivingMutationErrorResponse(
  error: BirthGivingPostgresError,
  supabase: SupabaseClient<Database>,
  eventId?: string,
): Promise<NextResponse> {
  const mapped = mapBirthGivingPostgresError(error);
  if (mapped) {
    const data = eventId ? await safelyRefreshEvent(supabase, eventId) : null;
    return NextResponse.json(
      { code: mapped.code, error: mapped.message, data },
      { status: mapped.status },
    );
  }

  if (error.code === "42501") {
    return NextResponse.json({ error: "Pro tuto akci nemáte oprávnění" }, { status: 403 });
  }
  if (error.code === "23503") {
    return NextResponse.json({ error: "Požadovaná data nebyla nalezena" }, { status: 404 });
  }

  console.error("Birth Giving mutation failed:", error);
  return NextResponse.json({ error: "Akci se nepodařilo dokončit" }, { status: 500 });
}

export async function refreshedEventResponse(
  supabase: SupabaseClient<Database>,
  eventId: string,
  status: 200 | 201 = 200,
): Promise<NextResponse> {
  const data = await getBirthGivingEvent(supabase, eventId);
  return NextResponse.json({ data }, { status });
}

async function safelyRefreshEvent(
  supabase: SupabaseClient<Database>,
  eventId: string,
) {
  try {
    return await getBirthGivingEvent(supabase, eventId);
  } catch {
    return null;
  }
}
