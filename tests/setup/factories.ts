import type { PoolClient } from "pg";

let seq = 0;

export async function insertAuthUser(
  client: PoolClient,
  opts: { email?: string; meta?: Record<string, unknown> } = {},
): Promise<{ id: string; email: string }> {
  seq += 1;
  const email = opts.email ?? `test-user-${seq}@example.com`;
  const meta = JSON.stringify(opts.meta ?? {});
  const { rows } = await client.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, $2::jsonb) returning id, email`,
    [email, meta],
  );
  return rows[0] as { id: string; email: string };
}
