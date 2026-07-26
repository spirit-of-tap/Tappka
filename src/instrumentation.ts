import type { Instrumentation } from "next";

export function register() {
  // No-op — PostHog client init is in instrumentation-client.ts
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  _context
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getPostHogServer } = await import("./lib/posthog-server");
    const posthog = getPostHogServer();

    let distinctId: string | null = null;

    const rawCookie = request.headers.cookie;
    if (rawCookie) {
      // Normalize string | string[] → string
      const cookieString = Array.isArray(rawCookie)
        ? rawCookie.join("; ")
        : rawCookie;

      const match = cookieString.match(/ph_.*?_posthog=([^;]+)/);
      if (match?.[1]) {
        try {
          const decoded = decodeURIComponent(match[1]);
          const data = JSON.parse(decoded) as { distinct_id?: string };
          distinctId = data.distinct_id ?? null;
        } catch {
          // Cookie parse failed — capture without user identity
        }
      }
    }

    await posthog.captureExceptionImmediate(err, distinctId ?? undefined);
  }
};
