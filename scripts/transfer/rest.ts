import type { Endpoint } from "./config";

export const PAGE_SIZE = 1000;

const INSERT_PREFER = "return=minimal,resolution=ignore-duplicates";

function headers(endpoint: Endpoint, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: endpoint.serviceKey,
    Authorization: `Bearer ${endpoint.serviceKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function failure(action: string, response: Response): Promise<Error> {
  const body = await response.text().catch(() => "");
  return new Error(`${action} failed: ${response.status} ${body}`);
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function selectAll<T>(
  endpoint: Endpoint,
  table: string,
  select = "*",
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${endpoint.restUrl}/${table}?select=${encodeURIComponent(select)}&limit=${PAGE_SIZE}&offset=${offset}`;
    const response = await fetch(url, { headers: headers(endpoint) });
    if (!response.ok) throw await failure(`GET ${table}`, response);
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function countRows(endpoint: Endpoint, table: string): Promise<number> {
  const response = await fetch(`${endpoint.restUrl}/${table}?select=*&limit=1`, {
    headers: headers(endpoint, { Prefer: "count=exact", Range: "0-0" }),
  });
  if (!response.ok) throw await failure(`COUNT ${table}`, response);

  const contentRange = response.headers.get("content-range");
  const total = Number(contentRange?.split("/")[1]);
  if (contentRange === null || !Number.isFinite(total)) {
    throw new Error(`COUNT ${table} failed: missing or unparsable content-range "${contentRange}"`);
  }
  return total;
}

export async function insertRows(
  endpoint: Endpoint,
  table: string,
  rows: readonly unknown[],
  onConflict?: string,
): Promise<void> {
  if (rows.length === 0) return;

  const query = onConflict === undefined
    ? ""
    : `?${new URLSearchParams({ on_conflict: onConflict }).toString()}`;

  const response = await fetch(`${endpoint.restUrl}/${table}${query}`, {
    method: "POST",
    headers: headers(endpoint, { Prefer: INSERT_PREFER }),
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw await failure(`INSERT ${table} (${rows.length} rows)`, response);
}

export async function patchRows(
  endpoint: Endpoint,
  table: string,
  filter: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${endpoint.restUrl}/${table}?${filter}`, {
    method: "PATCH",
    headers: headers(endpoint, { Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw await failure(`PATCH ${table} (${filter})`, response);
}

export async function deleteRows(
  endpoint: Endpoint,
  table: string,
  filter: string,
): Promise<void> {
  const response = await fetch(`${endpoint.restUrl}/${table}?${filter}`, {
    method: "DELETE",
    headers: headers(endpoint, { Prefer: "return=minimal" }),
  });
  if (!response.ok) throw await failure(`DELETE ${table} (${filter})`, response);
}
