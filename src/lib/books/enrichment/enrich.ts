import Perplexity from '@perplexity-ai/perplexity_ai';

import { buildSystemPrompt } from './rubric';
import { ENRICHMENT_JSON_SCHEMA, parseEnrichment, type EnrichedBook } from './schema';

const DEFAULT_MODEL = 'sonar-pro';
const SCHEMA_NAME = 'enriched_book';
/** Prefer the two sources the coaches actually trust for Czech titles and ratings. */
const SEARCH_DOMAINS = ['goodreads.com', 'databazeknih.cz'] as const;
const SEARCH_LANGUAGES = ['cs', 'en'] as const;

/** Consecutive failures before we stop trying. Per-instance and best-effort by design. */
export const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;

let consecutiveFailures = 0;
let circuitOpenedAt: number | null = null;

/** Test seam — clears breaker state between cases. */
export function resetCircuitBreaker(): void {
  consecutiveFailures = 0;
  circuitOpenedAt = null;
}

function circuitIsOpen(): boolean {
  if (circuitOpenedAt === null) return false;
  if (Date.now() - circuitOpenedAt > CIRCUIT_BREAKER_COOLDOWN_MS) {
    resetCircuitBreaker();
    return false;
  }
  return true;
}

function recordFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && circuitOpenedAt === null) {
    circuitOpenedAt = Date.now();
  }
}

export interface EnrichmentProbe {
  title: string;
  author: string;
  isbn_13?: string | null;
  page_count?: number | null;
  publisher?: string | null;
  published_year?: number | null;
}

export type EnrichmentOutcome =
  | { ok: true; value: EnrichedBook; citations: string[] }
  | { ok: false; reason: 'unavailable' | 'invalid'; message: string };

function buildUserPrompt(probe: EnrichmentProbe): string {
  const known = [
    `Název: ${probe.title}`,
    `Autor: ${probe.author}`,
    probe.isbn_13 ? `ISBN-13: ${probe.isbn_13}` : null,
    probe.page_count ? `Počet stran: ${probe.page_count}` : null,
    probe.publisher ? `Vydavatel: ${probe.publisher}` : null,
    probe.published_year ? `Rok vydání: ${probe.published_year}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return `Dohledej informace o této knize a ohodnoť ji podle rubriky.\n\n${known}\n\nPokud si u některého údaje nejsi jistý, nastav confidence na "low".`;
}

export async function enrichBook(probe: EnrichmentProbe): Promise<EnrichmentOutcome> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'unavailable', message: 'PERPLEXITY_API_KEY není nastavený.' };
  }

  if (circuitIsOpen()) {
    return { ok: false, reason: 'unavailable', message: 'Perplexity opakovaně neodpovídá.' };
  }

  const client = new Perplexity({ apiKey });

  let content: string | null = null;
  let citations: string[] = [];

  try {
    const response = await client.chat.completions.create({
      model: process.env.PERPLEXITY_MODEL ?? DEFAULT_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(probe) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: SCHEMA_NAME, schema: ENRICHMENT_JSON_SCHEMA },
      },
      search_domain_filter: [...SEARCH_DOMAINS],
      search_language_filter: [...SEARCH_LANGUAGES],
    });

    // The SDK's message content is typed for multimodal chat too (text | content
    // chunks | null); we only ever request plain text via response_format, so
    // treat anything else as absent rather than widening the type unsafely.
    const rawContent = response.choices?.[0]?.message?.content;
    content = typeof rawContent === 'string' ? rawContent : null;
    citations = response.citations ?? [];
  } catch (error) {
    recordFailure();
    console.error('Perplexity enrichment failed:', error);
    return { ok: false, reason: 'unavailable', message: 'Perplexity teď neodpovídá.' };
  }

  if (!content) {
    recordFailure();
    return { ok: false, reason: 'invalid', message: 'Perplexity vrátila prázdnou odpověď.' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(content);
  } catch {
    recordFailure();
    return { ok: false, reason: 'invalid', message: 'Odpověď nešla přečíst jako JSON.' };
  }

  const parsed = parseEnrichment(payload);
  if (!parsed.ok) {
    recordFailure();
    return { ok: false, reason: 'invalid', message: parsed.error };
  }

  resetCircuitBreaker();
  return { ok: true, value: parsed.value, citations };
}
