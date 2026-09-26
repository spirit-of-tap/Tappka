import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { sendMock } = vi.hoisted(() => {
  return {
    sendMock: vi.fn(),
  };
});

vi.mock('resend', () => {
  return {
    Resend: class {
      emails = { send: sendMock };
    },
  };
});

import { EMAIL_MAX_ATTEMPTS, sendEmail } from './send-email';

const MESSAGE = { to: 'a@b.cz', subject: 'S', html: 'h' };
const OK = { data: { id: 'provider-1' }, error: null, headers: {} };

function failure(name: string, statusCode: number | null, headers: Record<string, string> = {}) {
  return { data: null, error: { name, statusCode, message: `${name} happened` }, headers };
}

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

beforeEach(() => {
  sendMock.mockReset();
  process.env.RESEND_API_KEY = 'test-key';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sendEmail', () => {
  it('sends with the notification from-address', async () => {
    sendMock.mockResolvedValue(OK);

    await sendEmail({ to: 'a@b.cz', subject: 'Subj', html: '<p>hi</p>' });

    expect(sendMock).toHaveBeenCalledWith(
      {
        from: 'Tappka <notifications@tiimi.cz>',
        to: 'a@b.cz',
        subject: 'Subj',
        html: '<p>hi</p>',
      },
      { idempotencyKey: expect.any(String) },
    );
  });

  it('passes the caller idempotency key as SDK options and returns the provider ID', async () => {
    sendMock.mockResolvedValue({ data: { id: 'provider-123' }, error: null, headers: {} });

    const result = await sendEmail(
      { to: 'a@b.cz', subject: 'Subj', html: '<p>hi</p>' },
      { idempotencyKey: 'birth-giving-delivery-123' },
    );

    expect(sendMock).toHaveBeenCalledWith(
      {
        from: 'Tappka <notifications@tiimi.cz>',
        to: 'a@b.cz',
        subject: 'Subj',
        html: '<p>hi</p>',
      },
      { idempotencyKey: 'birth-giving-delivery-123' },
    );
    expect(result).toEqual({ id: 'provider-123' });
  });

  it('throws when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;

    await expect(sendEmail(MESSAGE)).rejects.toThrow('RESEND_API_KEY');
  });

  it('throws when Resend returns an error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'bad request' } });

    await expect(sendEmail(MESSAGE)).rejects.toThrow('bad request');
  });

  describe('retries', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it.each([
      ['rate limit', failure('rate_limit_exceeded', 429)],
      ['server error', failure('internal_server_error', 500)],
      ['network failure', failure('application_error', null)],
      ['concurrent idempotent request', failure('concurrent_idempotent_requests', 409)],
    ])('retries a %s and then succeeds', async (_label, transient) => {
      sendMock.mockResolvedValueOnce(transient).mockResolvedValueOnce(OK);

      await expect(settle(sendEmail(MESSAGE))).resolves.toEqual({ id: 'provider-1' });
      expect(sendMock).toHaveBeenCalledTimes(2);
    });

    it('reuses one idempotency key across attempts so a retry can never send twice', async () => {
      sendMock
        .mockResolvedValueOnce(failure('internal_server_error', 500))
        .mockResolvedValueOnce(failure('rate_limit_exceeded', 429))
        .mockResolvedValueOnce(OK);

      await settle(sendEmail(MESSAGE));

      const keys = sendMock.mock.calls.map((call) => (call[1] as { idempotencyKey: string }).idempotencyKey);
      expect(keys).toHaveLength(3);
      expect(new Set(keys).size).toBe(1);
    });

    it('also retries when the SDK itself throws', async () => {
      sendMock.mockRejectedValueOnce(new Error('socket hang up')).mockResolvedValueOnce(OK);

      await expect(settle(sendEmail(MESSAGE))).resolves.toEqual({ id: 'provider-1' });
    });

    it.each([
      ['validation_error', 422],
      ['invalid_from_address', 422],
      ['invalid_api_key', 403],
      ['daily_quota_exceeded', 429],
    ])('does not retry the permanent error %s', async (name, statusCode) => {
      sendMock.mockResolvedValue(failure(name, statusCode));

      const assertion = expect(sendEmail(MESSAGE)).rejects.toThrow(`${name} happened`);
      await vi.runAllTimersAsync();
      await assertion;
      expect(sendMock).toHaveBeenCalledTimes(1);
    });

    it(`gives up after ${EMAIL_MAX_ATTEMPTS} attempts and throws the last error`, async () => {
      sendMock.mockResolvedValue(failure('rate_limit_exceeded', 429));

      const result = sendEmail(MESSAGE);
      const assertion = expect(result).rejects.toThrow('rate_limit_exceeded happened');
      await vi.runAllTimersAsync();
      await assertion;
      expect(sendMock).toHaveBeenCalledTimes(EMAIL_MAX_ATTEMPTS);
    });

    it('waits for the retry-after header before retrying a rate limit', async () => {
      sendMock
        .mockResolvedValueOnce(failure('rate_limit_exceeded', 429, { 'retry-after': '3' }))
        .mockResolvedValueOnce(OK);

      const result = sendEmail(MESSAGE);
      await vi.advanceTimersByTimeAsync(2_999);
      expect(sendMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(sendMock).toHaveBeenCalledTimes(2);
      await expect(result).resolves.toEqual({ id: 'provider-1' });
    });
  });
});
