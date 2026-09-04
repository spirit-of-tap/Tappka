import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

import { POSTHOG_INGESTION_HOST } from "@/lib/posthog-config";

export const POSTHOG_SERVICE_NAME = "tappka";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const logsUrl = `${POSTHOG_INGESTION_HOST}/i/v1/logs`;

export const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({ "service.name": POSTHOG_SERVICE_NAME }),
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
