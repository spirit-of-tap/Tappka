import type { PoolClient } from "pg";

export async function asClaims(
  client: PoolClient,
  claims: Record<string, unknown>,
): Promise<void> {
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ role: "authenticated", ...claims }),
  ]);
  await client.query("set local role authenticated");
}

export async function asAnon(client: PoolClient): Promise<void> {
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ role: "anon" }),
  ]);
  await client.query("set local role anon");
}
