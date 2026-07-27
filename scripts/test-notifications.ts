import { commentEmail, coachReadEmail, voteEmail } from '../src/lib/notifications/email-templates';
import { sendEmail } from '../src/lib/notifications/send-email';

const TO = 'xkulo007@studenti.czu.cz';

const ESSAY_TITLE = 'Moje testovaci esej o AI';
const ESSAY_URL = 'https://tappka.cz/eseje/test-id';
const ACTOR_NAME = 'Jan Novák';

async function main() {
  console.log(`Sending 3 test emails to ${TO}...\n`);

  const templates = [
    {
      label: 'Comment',
      build: () => commentEmail({
        essayTitle: ESSAY_TITLE,
        essayUrl: ESSAY_URL,
        actorName: ACTOR_NAME,
        commentBody: 'Kvalitní analýza, díky za sdílení. Možná bych ještě rozvedl část o konkurenci — ale celkově výborná práce!',
      }),
    },
    {
      label: 'Coach Read',
      build: () => coachReadEmail({ essayTitle: ESSAY_TITLE, essayUrl: ESSAY_URL, actorName: ACTOR_NAME }),
    },
    {
      label: 'Vote (Like)',
      build: () => voteEmail({ essayTitle: ESSAY_TITLE, essayUrl: ESSAY_URL, actorName: ACTOR_NAME }),
    },
  ];

  for (const { label, build } of templates) {
    const { subject, html } = build();
    try {
      await sendEmail({ to: TO, subject, html });
      console.log(`  OK ${label} — "${subject}"`);
    } catch (err) {
      console.error(`  FAIL ${label} — ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
