export interface EssayEmailContext {
  essayTitle: string;
  essayUrl: string;
  actorName: string;
  commentBody?: string;
}

export interface BookLoanEmailContext {
  bookTitle: string;
  dueDate: string;
  loansUrl: string;
}

export interface EmailContent {
  subject: string;
  html: string;
}

function brandWrapper(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;font-family:'Roboto',Arial,sans-serif;background-color:#f5f5f5;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" style="max-width:600px;margin:0 auto;background-color:#FBFFF5;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #e5e5e5;">
              <h1 style="margin:0 0 8px;font-family:'Poppins',Arial,sans-serif;font-size:32px;font-weight:700;color:#b31b1b;letter-spacing:-0.5px;">
                Tappka
              </h1>
              <p style="margin:0;font-size:14px;color:#2c1a1d;opacity:0.7;font-weight:400;">
                Studentsk\u00fd port\u00e1l Tiimiakatemia Prague
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 40px 32px;">
              ${bodyHtml}
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px;text-align:center;border-top:1px solid #e5e5e5;">
              <p style="margin:0 0 4px;font-size:12px;color:#2c1a1d;opacity:0.6;">
                Tento e-mail byl odesl\u00e1n automaticky na z\u00e1klad\u011b tv\u00e9 aktivity na Tappce.
              </p>
              <p style="margin:0;font-size:12px;color:#2c1a1d;opacity:0.6;">
                &copy; 2026 Tappka. V\u0161echna pr\u00e1va vyhrazena.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<table role="presentation" style="margin:0 auto;">
    <tr>
      <td style="text-align:center;">
        <a href="${href}" style="display:inline-block;padding:14px 32px;background-color:#b31b1b;color:#FBFFF5;text-decoration:none;font-family:'Roboto',Arial,sans-serif;font-size:16px;font-weight:500;border-radius:6px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

export function coachReadEmail(ctx: EssayEmailContext): EmailContent {
  return {
    subject: `${ctx.actorName} si p\u0159e\u010detl/a tvou esej \u201e${ctx.essayTitle}\u201c`,
    html: brandWrapper(`
      <h2 style="margin:0 0 16px;font-family:'Poppins',Arial,sans-serif;font-size:24px;font-weight:600;color:#2c1a1d;line-height:1.3;">
        Esej byla p\u0159e\u010dtena
      </h2>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#2c1a1d;opacity:0.8;">
        <strong>${ctx.actorName}</strong> si p\u0159e\u010detl/a tvou esej <strong>\u201e${ctx.essayTitle}\u201c</strong>.
      </p>
      <div style="margin:32px 0;">
        ${ctaButton(ctx.essayUrl, 'Zobrazit esej')}
      </div>
    `),
  };
}

export function commentEmail(ctx: EssayEmailContext): EmailContent {
  const commentQuote = ctx.commentBody
    ? `<div style="margin:24px 0;padding:16px 20px;background-color:#f9f5f0;border-left:3px solid #b31b1b;border-radius:4px;font-size:15px;line-height:1.5;color:#2c1a1d;">
      ${escapeHtml(ctx.commentBody)}
    </div>`
    : '';

  return {
    subject: `${ctx.actorName} okomentoval/a tvou esej \u201e${ctx.essayTitle}\u201c`,
    html: brandWrapper(`
      <h2 style="margin:0 0 16px;font-family:'Poppins',Arial,sans-serif;font-size:24px;font-weight:600;color:#2c1a1d;line-height:1.3;">
        Nov\u00fd koment\u00e1\u0159
      </h2>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#2c1a1d;opacity:0.8;">
        <strong>${ctx.actorName}</strong> okomentoval/a tvou esej <strong>\u201e${ctx.essayTitle}\u201c</strong>:
      </p>
      ${commentQuote}
      <div style="margin:32px 0;">
        ${ctaButton(ctx.essayUrl, 'Zobrazit koment\u00e1\u0159')}
      </div>
    `),
  };
}

export function replyEmail(ctx: EssayEmailContext): EmailContent {
  const commentQuote = ctx.commentBody
    ? `<div style="margin:24px 0;padding:16px 20px;background-color:#f9f5f0;border-left:3px solid #b31b1b;border-radius:4px;font-size:15px;line-height:1.5;color:#2c1a1d;">
      ${escapeHtml(ctx.commentBody)}
    </div>`
    : '';

  return {
    subject: `${ctx.actorName} odpov\u011bd\u011bl/a na tv\u016fj koment\u00e1\u0159 u eseje \u201e${ctx.essayTitle}\u201c`,
    html: brandWrapper(`
      <h2 style="margin:0 0 16px;font-family:'Poppins',Arial,sans-serif;font-size:24px;font-weight:600;color:#2c1a1d;line-height:1.3;">
        Nov\u00e1 odpov\u011b\u010f na koment\u00e1\u0159
      </h2>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#2c1a1d;opacity:0.8;">
        <strong>${ctx.actorName}</strong> odpov\u011bd\u011bl/a na tv\u016fj koment\u00e1\u0159 u eseje <strong>\u201e${ctx.essayTitle}\u201c</strong>:
      </p>
      ${commentQuote}
      <div style="margin:32px 0;">
        ${ctaButton(ctx.essayUrl, 'Zobrazit odpov\u011b\u010f')}
      </div>
    `),
  };
}

export function voteEmail(ctx: EssayEmailContext): EmailContent {
  return {
    subject: `${ctx.actorName} dal/a like tv\u00e9 eseji \u201e${ctx.essayTitle}\u201c`,
    html: brandWrapper(`
      <h2 style="margin:0 0 16px;font-family:'Poppins',Arial,sans-serif;font-size:24px;font-weight:600;color:#2c1a1d;line-height:1.3;">
        Nov\u00fd like
      </h2>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#2c1a1d;opacity:0.8;">
        <strong>${ctx.actorName}</strong> dal/a like tv\u00e9 eseji <strong>\u201e${ctx.essayTitle}\u201c</strong>.
      </p>
      <div style="margin:32px 0;">
        ${ctaButton(ctx.essayUrl, 'Zobrazit esej')}
      </div>
    `),
  };
}

export function bookLoanEmail(ctx: BookLoanEmailContext): EmailContent {
  return {
    subject: `Vypůjčil/a sis „${ctx.bookTitle}“`,
    html: brandWrapper(`
      <div style="text-align:center;margin:0 0 24px;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background-color:#f9f5f0;font-size:32px;line-height:1;">📚</span>
      </div>
      <h2 style="margin:0 0 16px;font-family:'Poppins',Arial,sans-serif;font-size:24px;font-weight:600;color:#2c1a1d;line-height:1.3;text-align:center;">
        Kniha vypůjčena
      </h2>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#2c1a1d;opacity:0.8;text-align:center;">
        Vypůjčil/a sis <strong>„${ctx.bookTitle}“</strong> z TAP Knihovny.
      </p>
      <div style="margin:28px 0;padding:20px 24px;background-color:#f9f5f0;border-radius:8px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:500;color:#2c1a1d;opacity:0.6;text-transform:uppercase;letter-spacing:0.5px;">
          Vrať do
        </p>
        <p style="margin:0;font-size:22px;font-weight:700;font-family:'Poppins',Arial,sans-serif;color:#b31b1b;">
          ${ctx.dueDate}
        </p>
      </div>
      <div style="margin:32px 0 0;">
        ${ctaButton(ctx.loansUrl, 'Zobrazit moje výpůjčky')}
      </div>
    `),
  };
}

export interface BookSubmittedEmailContext {
  bookTitle: string;
  bookAuthor: string;
  submitterName: string;
  suggestedPoints: number | null;
  pointsReason: string | null;
  reviewUrl: string;
}

export interface BookDecisionEmailContext {
  bookTitle: string;
  approved: boolean;
  points: number | null;
  reason: string;
  bookUrl: string;
}

export function bookSubmittedEmail(ctx: BookSubmittedEmailContext): EmailContent {
  const points = ctx.suggestedPoints === null ? 'bez návrhu' : `${ctx.suggestedPoints} b.`;
  return {
    subject: `Nová kniha ke schválení: ${ctx.bookTitle}`,
    html: brandWrapper(`
      <h2 style="margin:0 0 16px;font-family:'Poppins',Arial,sans-serif;font-size:24px;font-weight:600;color:#2c1a1d;line-height:1.3;">
        Nová kniha ke schválení
      </h2>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#2c1a1d;opacity:0.8;">
        <strong>${ctx.submitterName}</strong> přidal knihu do BOBa a čeká na schválení.
      </p>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#2c1a1d;opacity:0.8;">
        <strong>${ctx.bookTitle}</strong><br />${ctx.bookAuthor}
      </p>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#2c1a1d;opacity:0.8;">
        Navržené hodnocení: <strong>${points}</strong>
      </p>
      ${ctx.pointsReason ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#2c1a1d;opacity:0.7;">${ctx.pointsReason}</p>` : ''}
      <div style="margin:32px 0;">
        ${ctaButton(ctx.reviewUrl, 'Zkontrolovat knihu')}
      </div>
    `),
  };
}

export function bookDecisionEmail(ctx: BookDecisionEmailContext): EmailContent {
  const verdict = ctx.approved ? 'schválena' : 'zamítnuta';
  return {
    subject: `Kniha ${ctx.bookTitle} byla ${verdict}`,
    html: brandWrapper(`
      <h2 style="margin:0 0 16px;font-family:'Poppins',Arial,sans-serif;font-size:24px;font-weight:600;color:#2c1a1d;line-height:1.3;">
        Kniha ${verdict}
      </h2>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#2c1a1d;opacity:0.8;">
        Kniha <strong>${ctx.bookTitle}</strong>, kterou jsi přidal do BOBa, byla ${verdict}.
      </p>
      ${ctx.approved && ctx.points !== null ? `<p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#2c1a1d;opacity:0.8;">Přidělené body: <strong>${ctx.points}</strong></p>` : ''}
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#2c1a1d;opacity:0.7;">
        <strong>Důvod:</strong> ${ctx.reason}
      </p>
      <div style="margin:32px 0;">
        ${ctaButton(ctx.bookUrl, 'Zobrazit knihu')}
      </div>
    `),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
