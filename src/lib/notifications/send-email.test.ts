import { describe, expect, it, vi, beforeEach } from 'vitest';

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

import { sendEmail } from './send-email';

beforeEach(() => {
  sendMock.mockReset();
  process.env.RESEND_API_KEY = 'test-key';
});

describe('sendEmail', () => {
  it('sends with the notification from-address', async () => {
    sendMock.mockResolvedValue({ data: { id: '1' }, error: null });

    await sendEmail({ to: 'a@b.cz', subject: 'Subj', html: '<p>hi</p>' });

    expect(sendMock).toHaveBeenCalledWith({
      from: 'Tappka <notifications@tiimi.cz>',
      to: 'a@b.cz',
      subject: 'Subj',
      html: '<p>hi</p>',
    });
  });

  it('passes an idempotency key as SDK options and returns the provider ID', async () => {
    sendMock.mockResolvedValue({ data: { id: 'provider-123' }, error: null });

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

    await expect(
      sendEmail({ to: 'a@b.cz', subject: 'S', html: 'h' }),
    ).rejects.toThrow('RESEND_API_KEY');
  });

  it('throws when Resend returns an error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'bad request' } });

    await expect(
      sendEmail({ to: 'a@b.cz', subject: 'S', html: 'h' }),
    ).rejects.toThrow('bad request');
  });
});
