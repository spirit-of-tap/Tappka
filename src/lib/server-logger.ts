import { after } from "next/server";
import { SeverityNumber } from "@opentelemetry/api-logs";

import {
  loggerProvider,
  POSTHOG_SERVICE_NAME,
} from "@/lib/posthog-logger-provider";

const logger = loggerProvider.getLogger(POSTHOG_SERVICE_NAME);
const REDACTED_VALUE = "[REDACTED]";
const UNSERIALIZABLE_VALUE = "[Unserializable value]";
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|email|password|secret|token|api[-_]?key/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[^\s,;]+/gi;
const POSTHOG_TOKEN_PATTERN = /\bph[ctx]_[A-Za-z0-9_-]+\b/g;

const CONSOLE_LEVELS = {
  debug: { severityNumber: SeverityNumber.DEBUG, severityText: "DEBUG" },
  error: { severityNumber: SeverityNumber.ERROR, severityText: "ERROR" },
  info: { severityNumber: SeverityNumber.INFO, severityText: "INFO" },
  log: { severityNumber: SeverityNumber.INFO, severityText: "INFO" },
  warn: { severityNumber: SeverityNumber.WARN, severityText: "WARN" },
} as const;

type ConsoleMethod = keyof typeof CONSOLE_LEVELS;
type ConsoleWriter = (...data: unknown[]) => void;

export interface ServerLogAttributes {
  [key: string]: string | number | boolean | undefined;
}

function redactText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, REDACTED_VALUE)
    .replace(BEARER_TOKEN_PATTERN, `Bearer ${REDACTED_VALUE}`)
    .replace(POSTHOG_TOKEN_PATTERN, REDACTED_VALUE);
}

function serializeConsoleArgument(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${redactText(value.message)}`;
  }

  if (typeof value === "string") return redactText(value);
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "symbol"
  ) {
    return String(value);
  }
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  try {
    return redactText(
      JSON.stringify(value, (key, nestedValue: unknown) => {
        if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED_VALUE;
        if (nestedValue instanceof Error) {
          return {
            name: nestedValue.name,
            message: redactText(nestedValue.message),
            stack: nestedValue.stack
              ? redactText(nestedValue.stack)
              : undefined,
          };
        }
        if (typeof nestedValue === "bigint") return String(nestedValue);
        return nestedValue;
      }) ?? UNSERIALIZABLE_VALUE
    );
  } catch {
    return UNSERIALIZABLE_VALUE;
  }
}

function withoutUndefined(
  attributes?: ServerLogAttributes
): Record<string, string | number | boolean> {
  if (!attributes) return {};

  return Object.fromEntries(
    Object.entries(attributes)
      .filter(
        (entry): entry is [string, string | number | boolean] =>
          entry[1] !== undefined
      )
      .map(([key, value]) => [
        key,
        typeof value === "string" ? redactText(value) : value,
      ])
  );
}

function scheduleFlush(): void {
  try {
    after(async () => {
      await loggerProvider.forceFlush();
    });
  } catch {
    // Outside a Next.js request, the batch processor handles delivery.
  }
}

function emit(
  body: string,
  severityNumber: SeverityNumber,
  severityText: string,
  attributes?: ServerLogAttributes
): void {
  try {
    logger.emit({
      body: redactText(body),
      severityNumber,
      severityText,
      attributes: withoutUndefined(attributes),
    });
    scheduleFlush();
  } catch {
    // Observability must never break application behavior.
  }
}

function emitConsole(method: ConsoleMethod, args: unknown[]): void {
  const consoleRecord = console as unknown as Record<ConsoleMethod, ConsoleWriter>;
  consoleRecord[method](...args);

  const error = args.find((argument) => argument instanceof Error);
  const level = CONSOLE_LEVELS[method];
  const body = args.map(serializeConsoleArgument).join(" ");

  emit(body, level.severityNumber, level.severityText, {
    "console.method": method,
    "log.source": "console",
    ...(error instanceof Error
      ? {
          "error.name": error.name,
          "error.message": redactText(error.message),
          "error.stack": error.stack ? redactText(error.stack) : undefined,
        }
      : {}),
  });
}

export const serverLogger = {
  info(body: string, attributes?: ServerLogAttributes) {
    emit(body, SeverityNumber.INFO, "INFO", attributes);
  },
  warn(body: string, attributes?: ServerLogAttributes) {
    emit(body, SeverityNumber.WARN, "WARN", attributes);
  },
  error(body: string, attributes?: ServerLogAttributes) {
    emit(body, SeverityNumber.ERROR, "ERROR", attributes);
  },
  debug(body: string, attributes?: ServerLogAttributes) {
    emit(body, SeverityNumber.DEBUG, "DEBUG", attributes);
  },
  async flush() {
    await loggerProvider.forceFlush();
  },
  console: {
    debug(...args: unknown[]) {
      emitConsole("debug", args);
    },
    error(...args: unknown[]) {
      emitConsole("error", args);
    },
    info(...args: unknown[]) {
      emitConsole("info", args);
    },
    log(...args: unknown[]) {
      emitConsole("log", args);
    },
    warn(...args: unknown[]) {
      emitConsole("warn", args);
    },
  },
};
