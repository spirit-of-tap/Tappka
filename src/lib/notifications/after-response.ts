import { after } from 'next/server';

import { serverLogger } from '@/lib/server-logger';

export interface NotificationTask {
  /** Used in the error log, e.g. `notifyEssayCommented`. */
  label: string;
  run: () => Promise<void>;
}

/**
 * Runs notification work after the response is sent, keeping the serverless
 * function alive until every task has finished.
 *
 * `after()` only extends the invocation for the promise its callback
 * *returns*. A callback that starts promises without returning them resolves
 * immediately, so Vercel may freeze the function mid-send — the email is lost
 * and nothing is logged. Always go through this helper instead of calling
 * `after()` with notification work directly.
 */
export function runNotificationsAfterResponse(tasks: NotificationTask[]): void {
  after(async () => {
    await Promise.all(
      tasks.map(async ({ label, run }) => {
        try {
          await run();
        } catch (error) {
          serverLogger.console.error(`${label} failed:`, error);
        }
      }),
    );

    try {
      await serverLogger.flush();
    } catch {
      // Log delivery failures must never surface as request errors.
    }
  });
}
