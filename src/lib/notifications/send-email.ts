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
  const { data, error } = options?.idempotencyKey
    ? await resend.emails.send(message, { idempotencyKey: options.idempotencyKey })
    : await resend.emails.send(message);

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
  if (!data?.id) throw new Error('Resend send failed: provider message ID is missing');

  return { id: data.id };
}
