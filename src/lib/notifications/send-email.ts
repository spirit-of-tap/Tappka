import { Resend } from 'resend';

import { NOTIFICATION_FROM_EMAIL } from './constants';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from: NOTIFICATION_FROM_EMAIL, to, subject, html });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
