import type { BirthGivingEventDetail } from "./types";

export interface BirthGivingMutationBody<TData = BirthGivingEventDetail> {
  data?: TData;
  code?: string;
  error?: string;
}

export interface BirthGivingMutationResult<TData = BirthGivingEventDetail> {
  ok: boolean;
  body: BirthGivingMutationBody<TData>;
}

export async function birthGivingMutationRequest<TData = BirthGivingEventDetail>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<BirthGivingMutationResult<TData>> {
  const response = await fetch(path, {
    method: options.method ?? "POST",
    headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = (await response.json().catch(() => ({}))) as BirthGivingMutationBody<TData>;
  return { ok: response.ok, body };
}