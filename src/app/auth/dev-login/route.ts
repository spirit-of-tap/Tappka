import { createPrivateKey, createSign, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

// Deploy-only route for the tailnet dev environment (tappka-dev/deploy.sh copies it in).
// It must never be committed to the app repo: it logs in a fixed account without Google.
//
// Local Supabase has the email provider off (enable_signup = false), so password login is
// impossible. Like tests/e2e/fixtures/auth.ts, this signs the session with the Supabase
// CLI's built-in local signing key, which only a local stack trusts.
const LOCAL_SIGNING_JWK = {
  kty: "EC",
  kid: "b81269f1-21d8-4f2e-b719-c2240a840d90",
  crv: "P-256",
  x: "M5Sjqn5zwC9Kl1zVfUUGvv9boQjCGd45G8sdopBExB4",
  y: "P6IXMvA2WYXSHSOMTBH2jsw_9rrzGy89FjPf6oOsIxQ",
  d: "dIhR8wywJlqlua4y_yMq2SLhlFXDZJBCvFrY1DCHyVU",
} as const;
const MEMBER_EMAIL = "dev-clen@studenti.czu.cz";
const SESSION_SECONDS = 7 * 24 * 3600;

function tokenMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function signJwt(payload: Record<string, unknown>): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "ES256", kid: LOCAL_SIGNING_JWK.kid, typ: "JWT" })}.${encode(payload)}`;
  const key = createPrivateKey({ key: LOCAL_SIGNING_JWK, format: "jwk" });
  const signature = createSign("sha256").update(unsigned).sign({ key, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${signature.toString("base64url")}`;
}

async function findAuthUserId(supabaseUrl: string, serviceKey: string, email: string): Promise<string | null> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) return null;
  const { users } = (await res.json()) as { users: { id: string; email?: string }[] };
  return users.find((user) => user.email === email)?.id ?? null;
}

export async function GET(request: NextRequest) {
  const expected = process.env.DEV_LOGIN_TOKEN;
  const adminEmail = process.env.DEV_LOGIN_EMAIL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!expected || !adminEmail || !supabaseUrl || !serviceKey) return new NextResponse(null, { status: 404 });
  if (!tokenMatches(request.nextUrl.searchParams.get("token"), expected)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ?as=clen signs in the plain team member seeded by seed-demo.mjs instead of the admin.
  const email = request.nextUrl.searchParams.get("as") === "clen" ? MEMBER_EMAIL : adminEmail;
  const userId = await findAuthUserId(supabaseUrl, serviceKey, email);
  if (!userId) return new NextResponse("Dev user not found, rerun deploy.sh", { status: 500 });

  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJwt({
    sub: userId,
    aud: "authenticated",
    role: "authenticated",
    email,
    app_metadata: { provider: "email", providers: ["email"] },
    iat: now,
    exp: now + SESSION_SECONDS,
  });
  const session = {
    access_token: accessToken,
    refresh_token: "",
    expires_in: SESSION_SECONDS,
    expires_at: now + SESSION_SECONDS,
    token_type: "bearer",
    user: null,
  };

  // @supabase/ssr names the cookie after the first label of the Supabase hostname.
  const cookieName = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  // request.url carries the bind address (100.x), not the tailnet hostname the cookie belongs to.
  const response = NextResponse.redirect(new URL("/", process.env.APP_URL ?? request.url));
  response.cookies.set(cookieName, `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, {
    path: "/",
    sameSite: "lax",
    maxAge: SESSION_SECONDS,
  });
  return response;
}
