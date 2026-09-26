import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const APP_DIR = join(process.cwd(), 'src', 'app');
const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const TEST_FILE_PATTERN = /\.test\.(ts|tsx)$/;
const NOTIFICATION_CALL_PATTERN = /\bnotify[A-Z]\w*\(|\bsendEmail\(/;
const AFTER_CALL_PATTERN = /\bafter\(/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE_FILE_PATTERN.test(entry.name) && !TEST_FILE_PATTERN.test(entry.name) ? [path] : [];
  });
}

/** Returns the text between the parentheses of the call starting at `openIndex`. */
function callArguments(source: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === '(') depth++;
    if (source[i] === ')' && --depth === 0) return source.slice(openIndex + 1, i);
  }
  return source.slice(openIndex + 1);
}

describe('notification scheduling guard', () => {
  it('never hands notification work to after() directly — use runNotificationsAfterResponse', () => {
    const offenders = sourceFiles(APP_DIR).flatMap((file) => {
      const source = readFileSync(file, 'utf-8');
      return [...source.matchAll(AFTER_CALL_PATTERN)]
        .filter((match) => NOTIFICATION_CALL_PATTERN.test(callArguments(source, match.index + match[0].length - 1)))
        .map(() => relative(process.cwd(), file));
    });

    // A plain after() callback that starts promises without returning them lets
    // Vercel freeze the function mid-send: the email is lost and nothing is logged.
    expect(offenders).toEqual([]);
  });
});
