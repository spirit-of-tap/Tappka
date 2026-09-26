import { serverLogger } from '@/lib/server-logger';

export type SkipSeverity = 'info' | 'warn';

/**
 * Records why a notification was not sent. Every early return in a notifier
 * must go through this (except the expected "actor acted on their own
 * content" case) so a missing email can be explained from the logs.
 * Use `info` for intended skips (opt-outs) and `warn` for anything unexpected.
 * Pass IDs only — never email addresses.
 */
export function logNotificationSkipped(
  notification: string,
  reason: string,
  context: Record<string, string>,
  severity: SkipSeverity = 'warn',
): void {
  serverLogger.console[severity](`${notification} skipped: ${reason}`, context);
}
