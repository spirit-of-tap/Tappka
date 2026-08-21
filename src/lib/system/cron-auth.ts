import { timingSafeEqual } from "crypto";

const BEARER_PREFIX = "Bearer ";

export function isAuthorizedCronRequest(request: Pick<Request, "headers">): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith(BEARER_PREFIX)) return false;

  const provided = Buffer.from(authorization.slice(BEARER_PREFIX.length));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
