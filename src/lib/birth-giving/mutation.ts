import type { BirthGivingEventDetail } from "./types";

export interface BirthGivingMutationBody {
  data?: BirthGivingEventDetail;
  code?: string;
  error?: string;
}

export interface BirthGivingMutationResult {
  ok: boolean;
  body: BirthGivingMutationBody;
}

export async function birthGivingMutationRequest(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<BirthGivingMutationResult> {
  const response = await fetch(path, {
    method: options.method ?? "POST",
    headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = (await response.json().catch(() => ({}))) as BirthGivingMutationBody;
  return { ok: response.ok, body };
}