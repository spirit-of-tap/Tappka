import { SeverityNumber } from "@opentelemetry/api-logs";

import { loggerProvider } from "@/instrumentation";

const SERVICE_NAME = "tappka";
const logger = loggerProvider.getLogger(SERVICE_NAME);

export interface ServerLogAttributes {
  [key: string]: string | number | boolean | undefined;
}

export const serverLogger = {
  info(body: string, attributes?: ServerLogAttributes) {
    logger.emit({
      body,
      severityNumber: SeverityNumber.INFO,
      attributes: attributes as Record<string, string | number | boolean>,
    });
  },
  warn(body: string, attributes?: ServerLogAttributes) {
    logger.emit({
      body,
      severityNumber: SeverityNumber.WARN,
      attributes: attributes as Record<string, string | number | boolean>,
    });
  },
  error(body: string, attributes?: ServerLogAttributes) {
    logger.emit({
      body,
      severityNumber: SeverityNumber.ERROR,
      attributes: attributes as Record<string, string | number | boolean>,
    });
  },
  debug(body: string, attributes?: ServerLogAttributes) {
    logger.emit({
      body,
      severityNumber: SeverityNumber.DEBUG,
      attributes: attributes as Record<string, string | number | boolean>,
    });
  },
  async flush() {
    await loggerProvider.forceFlush();
  },
};
