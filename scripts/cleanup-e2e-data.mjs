import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const envRaw = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, "$1");
}

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const GOTRUE_URL = `${SUPABASE_URL}/auth/v1`;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

async function restFetch(path, method, body) {
  const res = await fetch(`${REST_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && method !== "DELETE") {
    throw new Error(`REST ${method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

async function cleanup() {
  console.log("🔍 Finding E2E test teams...");
  const teams = await restFetch("/teams?name=like.*E2E Team *&select=id,name", "GET");
  console.log(`  Found ${teams.length} teams`);

  let totalProfiles = 0;
  let totalUsers = 0;

  for (const team of teams) {
    console.log(`\n📦 Team: ${team.name} (${team.id})`);

    // Find profiles in this team
    const profiles = await restFetch(`/profiles?team_id=eq.${team.id}&select=id,user_id`, "GET");
    console.log(`  ${profiles.length} profiles`);

    for (const profile of profiles) {
      // Delete profile-owned data
      await restFetch(`/feedback?author_profile_id=eq.${profile.id}`, "DELETE").catch(() => {});
      const essays = await restFetch(`/essays?author_profile_id=eq.${profile.id}&select=id`, "GET").catch(() => []);
      for (const e of essays) {
        await restFetch(`/essay_revisions?essay_id=eq.${e.id}`, "DELETE").catch(() => {});
      }
      await restFetch(`/essays?author_profile_id=eq.${profile.id}`, "DELETE").catch(() => {});
      await restFetch(`/books?created_by_profile_id=eq.${profile.id}`, "DELETE").catch(() => {});
      await restFetch(`/profiles?id=eq.${profile.id}`, "DELETE").catch(() => {});
      totalProfiles++;

      // Delete auth user
      if (profile.user_id) {
        // Resolve auth_user_id from public.users
        const userRows = await restFetch(`/users?id=eq.${profile.user_id}&select=auth_user_id`, "GET").catch(() => []);
        const auid = userRows[0]?.auth_user_id;
        if (auid) {
          await fetch(`${GOTRUE_URL}/admin/users/${auid}`, {
            method: "DELETE",
            headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
          }).catch(() => {});
          totalUsers++;
        }
      }
    }

    // Delete team-scoped data and the team itself
    await restFetch(`/recurring_schedules?team_id=eq.${team.id}`, "DELETE").catch(() => {});
    await restFetch(`/team_reflections?team_id=eq.${team.id}`, "DELETE").catch(() => {});
    await restFetch(`/team_semester_reflections?team_id=eq.${team.id}`, "DELETE").catch(() => {});
    await restFetch(`/teams?id=eq.${team.id}`, "DELETE").catch(() => {});
  }

  // Also find orphan auth users by email pattern (no matching team)
  console.log("\n🔍 Finding orphan E2E auth users...");
  const authUsers = await fetch(`${GOTRUE_URL}/admin/users`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  }).then((r) => r.json());
  const e2eUsers = (authUsers.users || []).filter((u) => u.email?.startsWith("e2e-test-"));
  console.log(`  Found ${e2eUsers.length} orphan auth users`);

  for (const u of e2eUsers) {
    await fetch(`${GOTRUE_URL}/admin/users/${u.id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    }).catch(() => {});
    totalUsers++;
  }

  console.log(`\n✅ Done! Deleted ${teams.length} teams, ${totalProfiles} profiles, ${totalUsers} auth users.`);
}

cleanup().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
