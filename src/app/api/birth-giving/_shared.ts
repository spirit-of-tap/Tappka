import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
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
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access";
import { serverLogger } from "@/lib/server-logger";

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
  if (
    !canAccessFeature(
      {
        role: profile.role,
        beta_access_granted_at: profile.beta_access_granted_at,
        beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
      },
      "birthGiving",
    )
  ) {
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
  return NextResponse.json(
    { code: BIRTH_GIVING_ERROR_CODES.invalidPayload, error: "Neplatná data požadavku" },
    { status: 400 },
  );
}

export function validateBirthGivingRouteIds(...ids: string[]): NextResponse | null {
  if (ids.every((id) => z.uuid().safeParse(id).success)) return null;
  return NextResponse.json(
    { code: BIRTH_GIVING_ERROR_CODES.invalidId, error: "Neplatný identifikátor" },
    { status: 400 },
  );
}

/**
 * The Birth Giving mutation/reporting RPCs accept a nullable `p_event_id` for
 * the create case, which the generated typed overloads don't express. Route
 * handlers call them through this narrowly typed adapter (bound to the
 * SupabaseClient so supabase-js retains its `this` context), keeping handler
 * code fully typed without hand-writing database types.
 */
type BirthGivingRpcCaller = (
  functionName: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: PostgrestError | null }>;

export async function callBirthGivingRpc<TData = null>(
  supabase: SupabaseClient<Database>,
  functionName: string,
  args: Record<string, unknown>,
): Promise<{ data: TData | null; error: PostgrestError | null }> {
  // supabase-js `rpc()` reads `this.rest`, so the method must stay bound to the
  // client. Calling `supabase.rpc(...)` directly here is impossible because the
  // stored `p_event_id: null` create-arg doesn't fit the generated `string` type.
  const caller = (supabase.rpc as unknown as BirthGivingRpcCaller).bind(supabase);
  const result = await caller(functionName, args);
  return { data: result.data as TData | null, error: result.error };
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

  serverLogger.console.error("Birth Giving mutation failed:", error);
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
