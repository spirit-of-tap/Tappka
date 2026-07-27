export interface EssayEmailContext {
  essayTitle: string;
  essayUrl: string;
  actorName: string;
  commentBody?: string;
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
