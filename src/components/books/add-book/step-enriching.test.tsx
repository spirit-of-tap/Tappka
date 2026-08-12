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

  it('opens with the found book already ticked off and the next task running', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(<StepEnriching probe={PROBE} onDone={vi.fn()} onManual={vi.fn()} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveAttribute('data-state', 'done');
    expect(items[1]).toHaveAttribute('data-state', 'running');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[3]).toHaveAttribute('data-state', 'upcoming');
  });

  it('never ticks off the last task, so a slow call does not look finished', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(<StepEnriching probe={PROBE} onDone={vi.fn()} onManual={vi.fn()} />);

    // Well past every phase interval — the checklist must still be working.
    await vi.advanceTimersByTimeAsync(60_000);

    const items = screen.getAllByRole('listitem');
    expect(items[3]).toHaveAttribute('data-state', 'running');
    vi.useRealTimers();
  });

  it('shows the cover when the candidate came with one', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(
      <StepEnriching
        probe={PROBE}
        coverUrl="https://books.google.com/sprint.jpg"
        onDone={vi.fn()}
        onManual={vi.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: 'Sprint' })).toHaveAttribute(
      'src',
      'https://books.google.com/sprint.jpg',
    );
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
