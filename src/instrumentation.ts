import type { Instrumentation } from "next";
import { logs } from "@opentelemetry/api-logs";

import { loggerProvider } from "@/lib/posthog-logger-provider";

export { loggerProvider } from "@/lib/posthog-logger-provider";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    logs.setGlobalLoggerProvider(loggerProvider);
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  _context
) => {
  // Note: PostHog docs recommend `export { onRequestError } from "@posthog/next"`.
  // We keep this hand-rolled hook to avoid adding a new dependency: it already
  // forwards client identity from tracing headers or the PostHog cookie.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    const errorName = err instanceof Error ? err.name : "Error";

    const { getPostHogServer } = await import("./lib/posthog-server");
    const posthog = getPostHogServer();

    let distinctId: string | null = null;

    const rawCookie = request.headers.cookie;
    const tracedDistinctId = request.headers["x-posthog-distinct-id"];
    const tracedSessionId = request.headers["x-posthog-session-id"];

    if (typeof tracedDistinctId === "string") {
      distinctId = tracedDistinctId;
    }

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
          distinctId ??= data.distinct_id ?? null;
        } catch {
          // Cookie parse failed — capture without user identity
        }
      }
    }

    const sessionId = Array.isArray(tracedSessionId)
      ? tracedSessionId[0]
      : tracedSessionId;

    // Dynamic import: keeps the edge instrumentation bundle free of the
    // Node-only OTel logger (which must never load in edge/middleware).
    const { serverLogger } = await import("./lib/server-logger");
    serverLogger.error(`Request error: ${errorMessage}`, {
      "error.name": errorName,
      "error.message": errorMessage,
      ...(errorStack ? { "error.stack": errorStack } : {}),
      "http.route": request.path,
      "http.method": request.method,
      ...(distinctId ? { posthogDistinctId: distinctId } : {}),
      ...(sessionId ? { sessionId } : {}),
    });

    await Promise.allSettled([
      posthog?.captureExceptionImmediate(err, distinctId ?? undefined),
      loggerProvider.forceFlush(),
    ]);
  }
};
