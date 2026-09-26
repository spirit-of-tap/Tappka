import { beforeEach, describe, expect, it, vi } from 'vitest';

const { afterMock, errorMock, flushMock } = vi.hoisted(() => ({
  afterMock: vi.fn(),
  errorMock: vi.fn(),
  flushMock: vi.fn(async () => {}),
}));

vi.mock('next/server', () => ({ after: afterMock }));
vi.mock('@/lib/server-logger', () => ({
  serverLogger: { console: { error: errorMock }, flush: flushMock },
}));

import { runNotificationsAfterResponse } from './after-response';

function capturedCallback(): () => unknown {
  expect(afterMock).toHaveBeenCalledTimes(1);
  return afterMock.mock.calls[0][0] as () => unknown;
}

beforeEach(() => {
  afterMock.mockReset();
  errorMock.mockReset();
  flushMock.mockClear();
});

describe('runNotificationsAfterResponse', () => {
  it('returns a promise from the after() callback that settles only once every task has finished', async () => {
    const events: string[] = [];
    let release!: () => void;
    const slow = new Promise<void>((resolve) => { release = resolve; });

    runNotificationsAfterResponse([
      { label: 'slow', run: async () => { await slow; events.push('slow done'); } },
      { label: 'fast', run: async () => { events.push('fast done'); } },
    ]);

    const result = capturedCallback()();
    // The platform keeps the function alive until this promise settles, so it
    // must be a real promise — a void callback lets Vercel freeze mid-send.
    expect(result).toBeInstanceOf(Promise);

    let settled = false;
    void (result as Promise<void>).then(() => { settled = true; });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    release();
    await result;
    expect(settled).toBe(true);
    expect(events).toEqual(['fast done', 'slow done']);
  });

  it('logs a failed task without stopping the others', async () => {
    const ran = vi.fn(async () => {});
    runNotificationsAfterResponse([
      { label: 'notifyBroken', run: async () => { throw new Error('boom'); } },
      { label: 'notifyOk', run: ran },
    ]);

    await capturedCallback()();

    expect(ran).toHaveBeenCalledTimes(1);
    expect(errorMock).toHaveBeenCalledWith('notifyBroken failed:', expect.any(Error));
  });

  it('flushes server logs after the tasks so failures reach the log backend before the function freezes', async () => {
    const order: string[] = [];
    flushMock.mockImplementationOnce(async () => { order.push('flush'); });
    runNotificationsAfterResponse([
      { label: 'task', run: async () => { order.push('task'); } },
    ]);

    await capturedCallback()();

    expect(order).toEqual(['task', 'flush']);
  });

  it('does not reject when flushing logs fails', async () => {
    flushMock.mockRejectedValueOnce(new Error('otlp down'));
    runNotificationsAfterResponse([{ label: 'task', run: async () => {} }]);

    await expect(capturedCallback()()).resolves.toBeUndefined();
  });
});
