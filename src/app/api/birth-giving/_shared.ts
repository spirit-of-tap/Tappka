import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserProfile } from "@/lib/auth-helpers";
import {
  BIRTH_GIVING_ERROR_CODES,
  mapBirthGivingPostgresError,
  type BirthGivingPostgresError,
} from "@/lib/birth-giving/api";
import { getBirthGivingEvent } from "@/lib/birth-giving/queries";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export interface BirthGivingIdentity {
  eventName: string;
  customer: string;
  startsAt: string;
}

interface BirthGivingApiContext {
  profileId: string;
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

  return { profileId: profile.id, supabase };
}

export function isBirthGivingApiGateFailure(
  result: BirthGivingApiContext | BirthGivingApiGateFailure,
): result is BirthGivingApiGateFailure {
  return "response" in result;
}

export function invalidPayloadResponse(): NextResponse {
  return NextResponse.json({ error: "Neplatná data požadavku" }, { status: 400 });
}

export async function birthGivingIdentityConflictResponse(
  supabase: SupabaseClient<Database>,
  identity: BirthGivingIdentity | null,
): Promise<NextResponse> {
  if (identity) {
    const { data } = await supabase.rpc("birth_giving_find_event_conflict", {
      p_normalized_customer: identity.customer,
      p_normalized_name: identity.eventName,
      p_starts_at: identity.startsAt,
    });
    const conflict = data?.[0];
    if (conflict?.id) {
      return NextResponse.json(
        {
          code: BIRTH_GIVING_ERROR_CODES.duplicateEvent,
          error: "Stejná Birth Giving událost už existuje.",
          data: {
            id: conflict.id,
            status: conflict.status,
            identity,
          },
        },
        { status: 409 },
      );
    }
  }
  return NextResponse.json(
    {
      code: BIRTH_GIVING_ERROR_CODES.duplicateEvent,
      error: "Stejná událost s těmito údaji už existuje.",
    },
    { status: 409 },
  );
}

export function validateBirthGivingRouteIds(...ids: string[]): NextResponse | null {
  if (ids.every((id) => z.uuid().safeParse(id).success)) return null;
  return NextResponse.json(
    { code: "INVALID_ID", error: "Neplatný identifikátor" },
    { status: 400 },
  );
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
    const data = eventId ? await safelyRefreshEvent(supabase, eventId) : null;
    return NextResponse.json(
      {
        code: "INVALID_RELATION",
        error: "Požadovaná vazba není pro tuto událost platná.",
        data,
      },
      { status: 409 },
    );
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
