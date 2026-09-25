import { randomUUID } from 'crypto';
import { Resend } from 'resend';

import { NOTIFICATION_FROM_EMAIL } from './constants';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailOptions {
  idempotencyKey?: string;
}

export interface SendEmailResult {
  id: string;
}

/** 1 attempt + 3 retries, per Resend's recommended 3–5 retries. */
export const EMAIL_MAX_ATTEMPTS = 4;
/** Exponential backoff: 1s, 2s, 4s. */
const EMAIL_RETRY_BASE_DELAY_MS = 1_000;
/** Upper bound for a server-provided `retry-after`, so one email can't stall the function. */
const EMAIL_RETRY_MAX_DELAY_MS = 10_000;
const MS_PER_SECOND = 1_000;
const SERVER_ERROR_STATUS = 500;

/**
 * Transient Resend errors worth retrying. Everything else (validation, auth,
 * domain, quota) needs a human fix, so retrying would only delay the error.
 * Note `daily_quota_exceeded` is also a 429 but is permanent for the day.
 * `application_error` with a null status is how the SDK reports network failures.
 */
const RETRYABLE_ERROR_NAMES: ReadonlySet<string> = new Set([
  'rate_limit_exceeded',
  'application_error',
  'internal_server_error',
  'concurrent_idempotent_requests',
]);

interface ResendFailure {
  name?: string;
  statusCode?: number | null;
  message: string;
}

class EmailSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly retryAfterMs: number | null,
  ) {
    super(message);
    this.name = 'EmailSendError';
  }
}

function isRetryable(error: ResendFailure): boolean {
  if (error.name && RETRYABLE_ERROR_NAMES.has(error.name)) return true;
  return typeof error.statusCode === 'number' && error.statusCode >= SERVER_ERROR_STATUS;
}

function parseRetryAfterMs(headers: Record<string, string> | null | undefined): number | null {
  const seconds = Number(headers?.['retry-after']);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds * MS_PER_SECOND, EMAIL_RETRY_MAX_DELAY_MS);
}

function backoffMs(attempt: number): number {
  return EMAIL_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptSend(
  resend: Resend,
  message: SendEmailParams & { from: string },
  idempotencyKey: string,
): Promise<SendEmailResult> {
  let response: Awaited<ReturnType<Resend['emails']['send']>>;
  try {
    response = await resend.emails.send(message, { idempotencyKey });
  } catch (error) {
    // The SDK normally reports failures in `error`; a throw means something
    // below it (runtime, network stack) broke, which is worth another try.
    const detail = error instanceof Error ? error.message : String(error);
    throw new EmailSendError(`Resend send failed: ${detail}`, true, null);
  }

  const { data, error, headers } = response;
  if (error) {
    throw new EmailSendError(
      `Resend send failed: ${error.message}`,
      isRetryable(error),
      parseRetryAfterMs(headers),
    );
  }
  if (!data?.id) {
    throw new EmailSendError('Resend send failed: provider message ID is missing', false, null);
  }
  return { id: data.id };
}

/**
 * Sends one email, retrying transient failures with exponential backoff.
 * Every attempt carries the same idempotency key, so a retry after a
 * timed-out-but-delivered request can never produce a duplicate email.
 */
export async function sendEmail(
  { to, subject, html }: SendEmailParams,
  options?: SendEmailOptions,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }

  const resend = new Resend(apiKey);
  const message = { from: NOTIFICATION_FROM_EMAIL, to, subject, html };
  const idempotencyKey = options?.idempotencyKey ?? randomUUID();

  for (let attempt = 1; ; attempt++) {
    try {
      return await attemptSend(resend, message, idempotencyKey);
    } catch (error) {
      const canRetry = error instanceof EmailSendError && error.retryable && attempt < EMAIL_MAX_ATTEMPTS;
      if (!canRetry) throw error;
      await sleep(error.retryAfterMs ?? backoffMs(attempt));
    }
  }
}
