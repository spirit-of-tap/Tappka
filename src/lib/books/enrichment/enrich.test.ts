import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();

vi.mock('@perplexity-ai/perplexity_ai', () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

import {
  enrichBook,
  resetCircuitBreaker,
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_COOLDOWN_MS,
} from './enrich';

const PROBE = { title: 'Sprint', author: 'Jake Knapp', page_count: 288 };

const VALID_CONTENT = JSON.stringify({
  title_cs: 'Sprint',
  title_en: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: null,
  page_count: 288,
  description: 'Naučíš se otestovat nápad za pět dní.',
  tag: 'Inovace & kreativita',
  suggested_points: 2,
  points_reason: 'Kategorie 2 — procesní manuál, 288 stran.',
  confidence: 'high',
});

beforeEach(() => {
  vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
  create.mockReset();
  resetCircuitBreaker();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('enrichBook', () => {
  it('returns the parsed record and the citations', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: VALID_CONTENT } }],
      citations: ['https://goodreads.com/sprint'],
    });

    const outcome = await enrichBook(PROBE);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.suggested_points).toBe(2);
      expect(outcome.citations).toEqual(['https://goodreads.com/sprint']);
    }
  });

  it('sends the probe metadata and the JSON schema', async () => {
    create.mockResolvedValue({ choices: [{ message: { content: VALID_CONTENT } }] });

    await enrichBook(PROBE);

    const args = create.mock.calls[0][0];
    expect(args.response_format.type).toBe('json_schema');
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[1].content).toContain('Sprint');
    expect(args.messages[1].content).toContain('288');
  });

  it('reports invalid when the payload violates the schema', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title_cs: 'X' }) } }],
    });

    const outcome = await enrichBook(PROBE);

    expect(outcome).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('reports invalid when the content is not JSON', async () => {
    create.mockResolvedValue({ choices: [{ message: { content: 'Tady je odpověď:' } }] });

    expect(await enrichBook(PROBE)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('reports unavailable when the API throws', async () => {
    create.mockRejectedValue(new Error('429 rate limited'));

    expect(await enrichBook(PROBE)).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('reports unavailable without calling the API when the key is missing', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', '');

    expect(await enrichBook(PROBE)).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(create).not.toHaveBeenCalled();
  });

  it('opens the circuit after consecutive failures and stops calling the API', async () => {
    create.mockRejectedValue(new Error('500'));

    for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i += 1) {
      await enrichBook(PROBE);
    }
    const callsWhileFailing = create.mock.calls.length;

    const outcome = await enrichBook(PROBE);

    expect(outcome).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(create.mock.calls.length).toBe(callsWhileFailing);
  });

  it('closes the circuit again after a success', async () => {
    create.mockRejectedValueOnce(new Error('500'));
    await enrichBook(PROBE);

    create.mockResolvedValue({ choices: [{ message: { content: VALID_CONTENT } }] });
    expect((await enrichBook(PROBE)).ok).toBe(true);
  });

  it('lets calls through again once the cooldown has elapsed', async () => {
    // The only untested branch of the breaker's state machine. A flipped
    // comparison here latches it open forever and enrichment dies silently.
    vi.useFakeTimers();
    try {
      create.mockRejectedValue(new Error('500'));
      for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i += 1) {
        await enrichBook(PROBE);
      }
      const callsWhileOpen = create.mock.calls.length;

      // Still inside the cooldown: no call reaches the API.
      await vi.advanceTimersByTimeAsync(CIRCUIT_BREAKER_COOLDOWN_MS - 1);
      await enrichBook(PROBE);
      expect(create.mock.calls.length).toBe(callsWhileOpen);

      // Past the cooldown: the breaker closes and the call goes through.
      await vi.advanceTimersByTimeAsync(2);
      create.mockResolvedValue({ choices: [{ message: { content: VALID_CONTENT } }] });
      expect((await enrichBook(PROBE)).ok).toBe(true);
      expect(create.mock.calls.length).toBeGreaterThan(callsWhileOpen);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports an empty completion as unavailable, so the user is offered a retry', async () => {
    create.mockResolvedValue({ choices: [{ message: { content: '' } }] });

    expect(await enrichBook(PROBE)).toMatchObject({ ok: false, reason: 'unavailable' });
  });
});
