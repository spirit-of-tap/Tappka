import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CopyEssaysButton } from './copy-essays-button';
import type { ExportableEssay } from '@/lib/essays/export-markdown';

const essay = (title: string): ExportableEssay => ({
  title,
  content_json: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Text eseje.' }] }],
  },
  created_at: '2026-09-01T12:00:00Z',
  book: null,
  content_source: null,
  frozen_book_points: null,
});

describe('CopyEssaysButton', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('copies the whole list as Markdown and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<CopyEssaysButton essays={[essay('První'), essay('Druhá')]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Kopírovat všechny eseje' }));

    expect(await screen.findByRole('button', { name: 'Zkopírováno' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(
      '## První\n\n**Datum:** 1. 9. 2026\n\nText eseje.\n\n---\n\n## Druhá\n\n**Datum:** 1. 9. 2026\n\nText eseje.\n',
    );
  });

  it('labels a single essay copy in the singular', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<CopyEssaysButton essays={[essay('Jediná')]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Kopírovat esej' }));

    expect(writeText).toHaveBeenCalledWith(
      '# Jediná\n\n**Datum:** 1. 9. 2026\n\nText eseje.\n',
    );
  });

  it('renders nothing when there is nothing to copy', () => {
    render(<CopyEssaysButton essays={[]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
