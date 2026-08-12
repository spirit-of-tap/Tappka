import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StepEnriching } from './step-enriching';

const PROBE = {
  title: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: null,
  page_count: 288,
  publisher: null,
  published_year: null,
};

const ENRICHED = {
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
  low_confidence_fields: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StepEnriching', () => {
  it('hands the enriched record up on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: ENRICHED, citations: ['https://goodreads.com/x'] }),
    }));
    const onDone = vi.fn();

    render(<StepEnriching probe={PROBE} onDone={onDone} onManual={vi.fn()} />);

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith(ENRICHED, ['https://goodreads.com/x']),
    );
  });

  it('names what it is doing rather than showing a bare spinner', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(<StepEnriching probe={PROBE} onDone={vi.fn()} onManual={vi.fn()} />);

    expect(screen.getByText(/hledám/i)).toBeInTheDocument();
  });

  it('offers retry and manual entry when enrichment fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Perplexity teď neodpovídá.' }),
    }));
    const onManual = vi.fn();

    render(<StepEnriching probe={PROBE} onDone={vi.fn()} onManual={onManual} />);

    await waitFor(() => expect(screen.getByText(/neodpovídá/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /zkusit znovu/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /vyplnit ručně/i }));
    expect(onManual).toHaveBeenCalledTimes(1);
  });

  it('treats a network rejection as a failure, not a hang', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<StepEnriching probe={PROBE} onDone={vi.fn()} onManual={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /vyplnit ručně/i })).toBeInTheDocument(),
    );
  });
});
