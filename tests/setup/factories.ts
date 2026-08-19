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

export async function insertVerifiedProfile(
  client: PoolClient,
  opts: { name?: string; email?: string; betaAccess?: boolean } = {},
): Promise<{ authUserId: string; profileId: string }> {
  const email = opts.email ?? `verified-${seq + 1}@studenti.czu.cz`;
  const authUser = await insertAuthUser(client, { email });
  const { rows: userRows } = await client.query(
    `update public.users
       set verified_work_email = $2, verified_work_email_at = now()
     where auth_user_id = $1
     returning id`,
    [authUser.id, email],
  );
  const { rows: profileRows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, role, beta_access_granted_at)
     values ($1, $2, $3, 'student', case when $4 then now() else null end)
     returning id`,
    [opts.name ?? `Verified ${seq}`, email, userRows[0].id, opts.betaAccess ?? true],
  );
  return {
    authUserId: authUser.id,
    profileId: profileRows[0].id as string,
  };
}
