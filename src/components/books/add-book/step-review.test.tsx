import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StepReview } from './step-review';
import { EMPTY_DRAFT, type AddBookDraft } from './types';

const CANDIDATE = {
  title: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: '9781501121746',
  description: null,
  cover_url: null,
  page_count: 288,
  publisher: 'Simon & Schuster',
  published_year: 2016,
  preview_link: 'https://books.google.com/x',
  source: 'google_books' as const,
  external_id: 'vol-1',
};

const ENRICHED_DRAFT: AddBookDraft = {
  ...EMPTY_DRAFT,
  candidate: CANDIDATE,
  enriched: {
    title_cs: 'Sprint',
    title_en: 'Sprint',
    author: 'Jake Knapp',
    isbn_13: '9781501121746',
    page_count: 288,
    description: 'Naučíš se otestovat nápad za pět dní. Je to hutné.',
    tag: 'Inovace & kreativita',
    suggested_points: 2,
    points_reason: 'Kategorie 2 — procesní manuál, 288 stran.',
    confidence: 'high',
    low_confidence_fields: [],
  },
  citations: ['https://goodreads.com/sprint'],
};

const MANUAL_DRAFT: AddBookDraft = {
  ...EMPTY_DRAFT,
  candidate: CANDIDATE,
  manual: true,
};

describe('StepReview', () => {
  it('shows the whole record including the points rationale and the sources', () => {
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} onDiscard={vi.fn()} />);

    expect(screen.getByLabelText(/český název/i)).toHaveValue('Sprint');
    expect(screen.getByText(/procesní manuál/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /goodreads/i })).toBeInTheDocument();
  });

  it('states that a coach reviews it and gets an email', () => {
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} onDiscard={vi.fn()} />);

    expect(screen.getByText(/půjde ke schválení/i)).toBeInTheDocument();
    expect(screen.getByText(/e-mail/i)).toBeInTheDocument();
  });

  it('offers discarding next to the submit action', async () => {
    const onDiscard = vi.fn();
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} onDiscard={onDiscard} />);

    await userEvent.click(screen.getByRole('button', { name: /zrušit přidávání/i }));

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('submits the edited record with the points and rationale the model chose', async () => {
    const onSubmit = vi.fn();
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={onSubmit} onDiscard={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /odeslat/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sprint',
        title_en: 'Sprint',
        author: 'Jake Knapp',
        page_count: 288,
        book_points: 2,
        points_reason: 'Kategorie 2 — procesní manuál, 288 stran.',
        tags: ['Inovace & kreativita'],
        source: 'google_books',
        preview_link: 'https://books.google.com/x',
      }),
    );
  });

  it('forwards the remote cover URL unchanged rather than downloading it', async () => {
    const onSubmit = vi.fn();
    const withCover: AddBookDraft = {
      ...ENRICHED_DRAFT,
      candidate: { ...CANDIDATE, cover_url: 'https://books.google.com/cover.jpg' },
    };
    render(<StepReview draft={withCover} submitting={false} onSubmit={onSubmit} onDiscard={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /odeslat/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ google_books_cover_url: 'https://books.google.com/cover.jpg' }),
    );
  });

  it('blocks submission when the title is cleared', async () => {
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} onDiscard={vi.fn()} />);

    await userEvent.clear(screen.getByLabelText(/český název/i));

    expect(screen.getByRole('button', { name: /odeslat/i })).toBeDisabled();
  });

  describe('the score belongs to the model, not the submitter', () => {
    it('shows the score as a read-only verdict with its reason', () => {
      render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} onDiscard={vi.fn()} />);

      expect(screen.getByLabelText('Knižní body: 2')).toBeInTheDocument();
      expect(screen.getByText(/návrh tappky ke schválení/i)).toBeInTheDocument();
    });

    it('offers no control that could change the score', () => {
      render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} onDiscard={vi.fn()} />);

      // The old picker rendered one button per category plus a 0-point option.
      expect(screen.queryByRole('button', { name: /\d\s*b\./i })).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: /knižní body/i })).not.toBeInTheDocument();
      // Submit and discard are the only buttons left on the screen.
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    it('never names the scoring categories', () => {
      render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} onDiscard={vi.fn()} />);

      expect(screen.queryByText(/inspirace/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/změna paradigmatu/i)).not.toBeInTheDocument();
    });

    it('submits without any points interaction at all', async () => {
      const onSubmit = vi.fn();
      render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={onSubmit} onDiscard={vi.fn()} />);

      await userEvent.click(screen.getByRole('button', { name: /odeslat/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ book_points: 2 }));
    });
  });

  describe('the manual path', () => {
    it('leaves the score to the coach instead of asking the submitter', () => {
      render(<StepReview draft={MANUAL_DRAFT} submitting={false} onSubmit={vi.fn()} onDiscard={vi.fn()} />);

      expect(screen.getByText('Body přidělí kouč:ka.')).toBeInTheDocument();
      expect(screen.queryByLabelText(/knižní body/i)).not.toBeInTheDocument();
    });

    it('blocks submission until description and tag are filled in', async () => {
      render(<StepReview draft={MANUAL_DRAFT} submitting={false} onSubmit={vi.fn()} onDiscard={vi.fn()} />);

      expect(screen.getByRole('button', { name: /odeslat/i })).toBeDisabled();

      await userEvent.type(screen.getByLabelText(/popis/i), 'Proč to číst: naučíš se…');
      await userEvent.selectOptions(screen.getByLabelText(/oblast/i), 'Leadership');

      expect(screen.getByRole('button', { name: /odeslat/i })).toBeEnabled();
    });

    it('submits a null score so the coach assigns one', async () => {
      const onSubmit = vi.fn();
      render(<StepReview draft={MANUAL_DRAFT} submitting={false} onSubmit={onSubmit} onDiscard={vi.fn()} />);

      await userEvent.type(screen.getByLabelText(/popis/i), 'Naučíš se…');
      await userEvent.selectOptions(screen.getByLabelText(/oblast/i), 'Leadership');
      await userEvent.click(screen.getByRole('button', { name: /odeslat/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ book_points: null, points_reason: null }),
      );
    });
  });

  describe('the appeal path', () => {
    const APPEAL_DRAFT: AddBookDraft = {
      ...ENRICHED_DRAFT,
      appealing: true,
      enriched: {
        ...ENRICHED_DRAFT.enriched!,
        description: 'ZAMÍTNUTO: Kniha nesouvisí se zaměřením programu TAP.',
        suggested_points: 0,
        points_reason: 'Beletrie — rozhoduje žánr, ne téma.',
      },
    };

    it('asks for an argument instead of prefilling the refusal', () => {
      render(<StepReview draft={APPEAL_DRAFT} submitting={false} onSubmit={vi.fn()} onDiscard={vi.fn()} />);

      expect(screen.getByLabelText(/proč kniha do boba patří/i)).toHaveValue('');
      expect(screen.queryByText(/ZAMÍTNUTO/)).not.toBeInTheDocument();
    });

    it('requires the argument before it can be sent', async () => {
      render(<StepReview draft={APPEAL_DRAFT} submitting={false} onSubmit={vi.fn()} onDiscard={vi.fn()} />);

      expect(screen.getByRole('button', { name: /odeslat/i })).toBeDisabled();

      await userEvent.type(
        screen.getByLabelText(/proč kniha do boba patří/i),
        'Je to případová studie, ne beletrie.',
      );

      expect(screen.getByRole('button', { name: /odeslat/i })).toBeEnabled();
    });

    it("carries the model's refusal to the coach alongside the appeal", async () => {
      const onSubmit = vi.fn();
      render(<StepReview draft={APPEAL_DRAFT} submitting={false} onSubmit={onSubmit} onDiscard={vi.fn()} />);

      await userEvent.type(
        screen.getByLabelText(/proč kniha do boba patří/i),
        'Je to případová studie.',
      );
      await userEvent.click(screen.getByRole('button', { name: /odeslat/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          book_points: 0,
          points_reason: 'Beletrie — rozhoduje žánr, ne téma.',
          description: 'Je to případová studie.',
        }),
      );
    });

    it('still shows the verdict the submitter is arguing against', () => {
      render(<StepReview draft={APPEAL_DRAFT} submitting={false} onSubmit={vi.fn()} onDiscard={vi.fn()} />);

      expect(screen.getByLabelText('Knižní body: 0')).toBeInTheDocument();
      expect(screen.getByText('Beletrie — rozhoduje žánr, ne téma.')).toBeInTheDocument();
    });
  });

  describe('uncertain fields', () => {
    it('names them in the banner and highlights their inputs', () => {
      render(
        <StepReview
          draft={{
            ...ENRICHED_DRAFT,
            enriched: {
              ...ENRICHED_DRAFT.enriched!,
              confidence: 'low',
              low_confidence_fields: ['author', 'page_count'],
            },
          }}
          submitting={false}
          onSubmit={vi.fn()} onDiscard={vi.fn()}
        />,
      );

      expect(screen.getByText(/zkontroluj:/i)).toBeInTheDocument();
      expect(screen.getByText(/autor, počet stran/i)).toBeInTheDocument();

      expect(screen.getByLabelText(/autor/i)).toHaveAttribute('data-uncertain', 'true');
      expect(screen.getByLabelText(/počet stran/i)).toHaveAttribute('data-uncertain', 'true');
      expect(screen.getByLabelText(/český název/i)).not.toHaveAttribute('data-uncertain');
    });

    it('does not highlight inputs the model is certain about', () => {
      render(
        <StepReview
          draft={{
            ...ENRICHED_DRAFT,
            enriched: {
              ...ENRICHED_DRAFT.enriched!,
              confidence: 'low',
              low_confidence_fields: ['title_cs'],
            },
          }}
          submitting={false}
          onSubmit={vi.fn()} onDiscard={vi.fn()}
        />,
      );

      expect(screen.getByLabelText(/český název/i)).toHaveAttribute('data-uncertain', 'true');
      expect(screen.getByLabelText(/autor/i)).not.toHaveAttribute('data-uncertain');
    });

    it('puts an uncertain score on the verdict card, never in the banner', () => {
      render(
        <StepReview
          draft={{
            ...ENRICHED_DRAFT,
            enriched: {
              ...ENRICHED_DRAFT.enriched!,
              confidence: 'low',
              low_confidence_fields: ['suggested_points'],
            },
          }}
          submitting={false}
          onSubmit={vi.fn()} onDiscard={vi.fn()}
        />,
      );

      expect(screen.getByText(/hodnocením si tappka nebyla jistá/i)).toBeInTheDocument();
      // Asking someone to check a field they cannot edit is nonsense.
      expect(screen.queryByText(/zkontroluj:/i)).not.toBeInTheDocument();
    });

    it('never asks the submitter to check the ISBN, which has no control', () => {
      render(
        <StepReview
          draft={{
            ...ENRICHED_DRAFT,
            enriched: {
              ...ENRICHED_DRAFT.enriched!,
              confidence: 'low',
              low_confidence_fields: ['isbn_13', 'author'],
            },
          }}
          submitting={false}
          onSubmit={vi.fn()} onDiscard={vi.fn()}
        />,
      );

      expect(screen.getByText('autor.')).toBeInTheDocument();
      expect(screen.queryByText(/ISBN/)).not.toBeInTheDocument();
    });
  });
});
