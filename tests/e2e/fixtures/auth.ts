import { createPrivateKey, createSign, randomUUID } from "crypto";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import type { BrowserContext } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, "../../../.env.local");
const envRaw = readFileSync(envPath, "utf-8");
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, "$1");
  process.env[key] ??= val;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOTRUE_URL = `${SUPABASE_URL}/auth/v1`;
const STORAGE_KEY = "sb-127-auth-token";
const REST_URL = `${SUPABASE_URL}/rest/v1`;

const EC_JWK = {
  kty: "EC",
  kid: "b81269f1-21d8-4f2e-b719-c2240a840d90",
  crv: "P-256",
  x: "M5Sjqn5zwC9Kl1zVfUUGvv9boQjCGd45G8sdopBExB4",
  y: "P6IXMvA2WYXSHSOMTBH2jsw_9rrzGy89FjPf6oOsIxQ",
  d: "dIhR8wywJlqlua4y_yMq2SLhlFXDZJBCvFrY1DCHyVU",
};

const ecKey = createPrivateKey({ key: EC_JWK, format: "jwk" });

function base64url(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

function encodeES256Sig(derSig: Buffer): string {
  let off = 2;
  off++;
  let rLen = derSig[off]; off++;
  if (derSig[off] === 0) { off++; rLen--; }
  const r = derSig.subarray(off, off + Math.min(rLen, 32));
  off += rLen;
  off++;
  let sLen = derSig[off]; off++;
  if (derSig[off] === 0) { off++; sLen--; }
  const s = derSig.subarray(off, off + Math.min(sLen, 32));
  const rPadded = Buffer.alloc(32);
  r.copy(rPadded, 32 - r.length);
  const sPadded = Buffer.alloc(32);
  s.copy(sPadded, 32 - s.length);
  return base64url(Buffer.concat([rPadded, sPadded]));
}

function createJWT(payload: Record<string, unknown>): string {
  const header = { alg: "ES256", kid: EC_JWK.kid, typ: "JWT" };
  const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  const signer = createSign("sha256");
  signer.update(`${headerB64}.${payloadB64}`);
  const derSig = signer.sign(ecKey);
  const sigB64 = encodeES256Sig(derSig);
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

async function gotrueAdminFetch(
  path: string,
  body?: Record<string, unknown>,
) {
  const res = await fetch(`${GOTRUE_URL}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(
      `GoTrue admin ${path} failed: ${res.status} ${await res.text()}`,
    );
  }
  return res.json();
}

async function restFetch(
  path: string,
  method: string,
  body?: Record<string, unknown>,
) {
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
  if (!res.ok) {
    throw new Error(
      `REST ${method} ${path} failed: ${res.status} ${await res.text()}`,
    );
  }
  return res.json();
}

function makeSessionCookie(
  userId: string,
  email: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = createJWT({
    sub: userId,
    aud: "authenticated",
    role: "authenticated",
    email,
    app_metadata: {
      provider: "email",
      providers: ["email"],
    },
    exp: now + 3600,
    iat: now,
  });

  const session = {
    access_token: accessToken,
    refresh_token: "",
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: "bearer",
    user: null,
  };

  const encoded = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `base64-${encoded}`;
}

export async function getSessionCookie(): Promise<string> {
  const email = `e2e-test-${randomUUID().slice(0, 8)}@studenti.czu.cz`;

  const userData = (await gotrueAdminFetch("/admin/users", {
    email,
    password: "test-password-123",
    email_confirm: true,
  })) as { id: string };

  _trackedUsers.add(userData.id);

  return makeSessionCookie(userData.id, email);
}

/**
 * Creates a complete user with team + profile and returns a session cookie.
 * Needed for pages that check current_profile_id().
 *
 * Pass `teamId` to place the user in a specific (e.g. test-isolated) team
 * instead of reusing/creating a shared one — needed whenever a test relies
 * on team-scoped uniqueness or doesn't want to pollute real team data.
 */
export async function getSetupSessionCookie(
  teamId?: string,
  role: "student" | "coach" | "admin" = "student",
): Promise<{
  cookie: string;
  userId: string;
  email: string;
  profileId: string;
  teamId: string;
}> {
  const email = `e2e-test-${randomUUID().slice(0, 8)}@studenti.czu.cz`;

  const userData = (await gotrueAdminFetch("/admin/users", {
    email,
    password: "test-password-123",
    email_confirm: true,
  })) as { id: string };

  const userId = userData.id;

  // Get public.users row (created by trigger)
  const usersRows = (await restFetch(
    `/users?auth_user_id=eq.${userId}&select=id`,
    "GET",
  )) as { id: string }[];
  const internalUserId = usersRows[0]?.id;

  if (!internalUserId) {
    throw new Error(`public.users not created for auth_user_id=${userId}`);
  }

  // Set verified_work_email so profiles SELECT RLS allows access
  await restFetch(
    `/users?id=eq.${internalUserId}`,
    "PATCH",
    { verified_work_email: email },
  );

  _trackedUsers.add(userId);

  // Always create a fresh team so each test group owns its data and can
  // safely clean up without affecting other groups.
  const resolvedTeamId = teamId ?? await createTestTeam();

  // Create profile
  const profiles = (await restFetch("/profiles", "POST", {
    name: "E2E Test User",
    work_email: email,
    user_id: internalUserId,
    team_id: resolvedTeamId,
    role,
  })) as { id: string }[];

  const profileId = profiles[0]?.id;
  if (!profileId) {
    throw new Error("Failed to create profile");
  }
  _trackedProfiles.add(profileId);

  return { cookie: makeSessionCookie(userId, email), userId, email, profileId, teamId: resolvedTeamId };
}

/** Track created resources per worker so afterAll can clean them up. */
const _trackedTeams = new Set<string>();
const _trackedUsers = new Set<string>();
const _trackedProfiles = new Set<string>();

/** Creates a brand new, isolated team — for tests that must not touch real team data. */
export async function createTestTeam(onboardingYear?: number): Promise<string> {
  const newTeams = (await restFetch(
    "/teams",
    "POST",
    {
      name: `E2E Team ${randomUUID().slice(0, 8)}`,
      ...(onboardingYear !== undefined && { onboardingYear }),
    },
  )) as { id: string }[];
  const id = newTeams[0].id;
  _trackedTeams.add(id);
  return id;
}

/** Deletes all data created by the current worker's E2E tests.
 *
 *  Must be called from test.afterAll (or a global teardown). Safe to call
 *  multiple times — subsequent calls are no-ops once the sets are empty.
 *  Within each phase, deletions run in parallel (Promise.all) for speed.
 */
export async function cleanupTestData(): Promise<void> {
  const teamIds = [..._trackedTeams];
  const userIds = [..._trackedUsers];
  const profileIds = [..._trackedProfiles];

  if (teamIds.length === 0 && userIds.length === 0 && profileIds.length === 0) return;

  // Phase 1 — delete profile-owned data (CASCADE on author FKs handles
  // essays → essay_revisions, essay_comments, etc.)
  await Promise.all(profileIds.flatMap((pid) => [
    restFetch(`/feedback?author_profile_id=eq.${pid}`, "DELETE").catch(() => {}),
    restFetch(`/essays?author_profile_id=eq.${pid}`, "DELETE").catch(() => {}),
    restFetch(`/books?created_by_profile_id=eq.${pid}`, "DELETE").catch(() => {}),
  ]));

  // Phase 2 — delete team-scoped data
  await Promise.all(teamIds.flatMap((tid) => [
    restFetch(`/recurring_schedules?team_id=eq.${tid}`, "DELETE").catch(() => {}),
    restFetch(`/team_reflections?team_id=eq.${tid}`, "DELETE").catch(() => {}),
    restFetch(`/team_activities?team_id=eq.${tid}`, "DELETE").catch(() => {}),
    restFetch(`/team_semester_reflections?team_id=eq.${tid}`, "DELETE").catch(() => {}),
  ]));

  // Phase 3 — delete profiles
  await Promise.all(profileIds.map((pid) =>
    restFetch(`/profiles?id=eq.${pid}`, "DELETE").catch(() => {}),
  ));

  // Phase 4 — delete teams
  await Promise.all(teamIds.map((tid) =>
    restFetch(`/teams?id=eq.${tid}`, "DELETE").catch(() => {}),
  ));

  // Phase 5 — delete auth users
  await Promise.all(userIds.map((uid) =>
    fetch(`${GOTRUE_URL}/admin/users/${uid}`, {
      method: "DELETE",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }).catch(() => {}),
  ));

  _trackedTeams.clear();
  _trackedUsers.clear();
  _trackedProfiles.clear();
}

/** Grants beta access, needed for pages gated on profile.beta_access_granted_at. */
export async function grantBetaAccess(profileId: string): Promise<void> {
  await restFetch(`/profiles?id=eq.${profileId}`, "PATCH", {
    beta_access_granted_at: new Date().toISOString(),
  });
}

/** Seeds a team reflection row directly, bypassing the UI. */
export async function seedTeamReflection(
  teamId: string,
  profileId: string,
  month: string,
): Promise<{ reflectionId: string }> {
  const rows = (await restFetch("/team_reflections", "POST", {
    team_id: teamId,
    month,
    created_by_profile_id: profileId,
    updated_by_profile_id: profileId,
  })) as { id: string }[];
  return { reflectionId: rows[0].id };
}

/** Seeds a team activity row directly, bypassing the UI. */
export async function seedTeamActivity(
  teamId: string,
  profileId: string,
  occurredAt: string,
): Promise<{ activityId: string }> {
  const rows = (await restFetch("/team_activities", "POST", {
    team_id: teamId,
    occurred_at: occurredAt,
    activity_type: "E2E team building",
    created_by_profile_id: profileId,
    updated_by_profile_id: profileId,
  })) as { id: string }[];
  return { activityId: rows[0].id };
}

/** Create a seeded book for E2E tests. */
export async function seedBook(profileId: string): Promise<{ bookId: string }> {
  const books = (await restFetch("/books", "POST", {
    title_cs: "E2E Test Book",
    title_en: "E2E Test Book",
    author: "E2E Test Author",
    book_points: 1,
    list_status: "longlist",
    source: "manual",
    created_by_profile_id: profileId,
    updated_by_profile_id: profileId,
  })) as { id: string }[];
  return { bookId: books[0].id };
}

/** Create a seeded essay for E2E tests. */
export async function seedEssay(
  profileId: string,
  bookId?: string,
): Promise<{ essayId: string }> {
  const essays = (await restFetch("/essays", "POST", {
    author_profile_id: profileId,
    book_id: bookId ?? null,
    published_at: new Date().toISOString(),
    created_by_profile_id: profileId,
    updated_by_profile_id: profileId,
  })) as { id: string }[];

  const essayId = essays[0].id;

  await restFetch("/essay_revisions", "POST", {
    essay_id: essayId,
    revision_no: 1,
    title: "E2E Test Essay",
    content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "E2E test essay content for navigation testing." }] }] },
    created_by_profile_id: profileId,
    updated_by_profile_id: profileId,
  });

  return { essayId };
}

export async function setAuthCookie(
  context: BrowserContext,
  cookieValue: string,
): Promise<void> {
  await context.addCookies([
    {
      name: STORAGE_KEY,
      value: cookieValue,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
}
