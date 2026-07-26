export interface EssayEmailContext {
  essayTitle: string;
  essayUrl: string;
  actorName: string;
}

export interface EmailContent {
  subject: string;
  html: string;
}

function wrapEmail(bodyHtml: string): string {
  return `<div style="font-family: sans-serif; font-size: 15px; color: #111;">${bodyHtml}</div>`;
}

export function coachReadEmail(ctx: EssayEmailContext): EmailContent {
  return {
    subject: `${ctx.actorName} přečetl/a tvou esej „${ctx.essayTitle}"`,
    html: wrapEmail(
      `<p>${ctx.actorName} si přečetl/a tvou esej <strong>${ctx.essayTitle}</strong>.</p>` +
        `<p><a href="${ctx.essayUrl}">Zobrazit esej</a></p>`,
    ),
  };
}

export function commentEmail(ctx: EssayEmailContext): EmailContent {
  return {
    subject: `${ctx.actorName} okomentoval/a tvou esej „${ctx.essayTitle}"`,
    html: wrapEmail(
      `<p>${ctx.actorName} přidal/a komentář k tvé eseji <strong>${ctx.essayTitle}</strong>.</p>` +
        `<p><a href="${ctx.essayUrl}">Zobrazit komentář</a></p>`,
    ),
  };
}

export function voteEmail(ctx: EssayEmailContext): EmailContent {
  return {
    subject: `${ctx.actorName} dal/a like tvé eseji „${ctx.essayTitle}"`,
    html: wrapEmail(
      `<p>${ctx.actorName} dal/a like tvé eseji <strong>${ctx.essayTitle}</strong>.</p>` +
        `<p><a href="${ctx.essayUrl}">Zobrazit esej</a></p>`,
    ),
  };
}
