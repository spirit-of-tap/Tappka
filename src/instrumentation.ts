import type { Instrumentation } from "next";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";
const SERVICE_NAME = "tappka";

const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST;
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const logsUrl = `${posthogHost.replace(/\/+$/, "")}/i/v1/logs`;

export const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({ "service.name": SERVICE_NAME }),
  processors: posthogKey
    ? [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: logsUrl,
            headers: {
              Authorization: `Bearer ${posthogKey}`,
              "Content-Type": "application/json",
            },
          }),
        }),
      ]
    : [],
});

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
  // forwards the client distinct_id from the PostHog cookie for identity linking.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const logger = loggerProvider.getLogger(SERVICE_NAME);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    const errorName = err instanceof Error ? err.name : "Error";

    logger.emit({
      body: `Request error: ${errorMessage}`,
      severityNumber: SeverityNumber.ERROR,
      attributes: {
        "error.name": errorName,
        "error.message": errorMessage,
        ...(errorStack ? { "error.stack": errorStack } : {}),
        "http.route": request.path,
        "http.method": request.method,
      },
    });

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

    await Promise.allSettled([
      posthog?.captureExceptionImmediate(err, distinctId ?? undefined),
      loggerProvider.forceFlush(),
    ]);
  }
};
