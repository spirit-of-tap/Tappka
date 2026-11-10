import { contentJsonToMarkdown } from './content-markdown';
import { getEssaySourceDisplay } from './source-display';
import type { EssayWithDetails } from './types';

/** Fields the clipboard export reads — every caller already holds the full row. */
export type ExportableEssay = Pick<
  EssayWithDetails,
  'title' | 'content_json' | 'created_at' | 'book' | 'content_source' | 'frozen_book_points'
>;

const ESSAY_SEPARATOR = '\n\n---\n\n';
const SINGLE_ESSAY_HEADING = 1;
const LIST_HEADING = 2;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

/** Book/source name plus author; legacy rows have no real source to name. */
function sourceLine(essay: ExportableEssay): string | null {
  const source = getEssaySourceDisplay(essay);
  if (!source.title || source.kind === 'legacy') return null;
  return source.author ? `${source.title} — ${source.author}` : source.title;
}

function formatEssay(essay: ExportableEssay, headingLevel: number): string {
  const heading = `${'#'.repeat(headingLevel)} ${essay.title}`;
  const source = sourceLine(essay);
  const meta = [source && `**Zdroj:** ${source}`, `**Datum:** ${formatDate(essay.created_at)}`]
    .filter(Boolean)
    .join(' · ');

  return [heading, meta, contentJsonToMarkdown(essay.content_json)]
    .filter((part) => part !== '')
    .join('\n\n');
}

/**
 * Markdown for pasting essays into a doc or an AI chat: a single essay gets a
 * `#` heading, several essays get `##` blocks separated by `---`.
 */
export function formatEssaysForClipboard(essays: ExportableEssay[]): string {
  const headingLevel = essays.length === 1 ? SINGLE_ESSAY_HEADING : LIST_HEADING;
  return `${essays.map((essay) => formatEssay(essay, headingLevel)).join(ESSAY_SEPARATOR)}\n`;
}

export function formatEssayForClipboard(essay: ExportableEssay): string {
  return formatEssaysForClipboard([essay]);
}
