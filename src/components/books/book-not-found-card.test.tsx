import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BookNotFoundCard } from './book-not-found-card';

describe('BookNotFoundCard', () => {
  it('links to the flow carrying the query and the search context', () => {
    render(<BookNotFoundCard query="atomic habits" from="hledat" />);

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/cteni/knihy/nova?q=atomic+habits&from=hledat',
    );
  });

  it('carries the essay id when opened from the editor', () => {
    render(<BookNotFoundCard query="sprint" from="esej" essayId="e1" />);

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/cteni/knihy/nova?q=sprint&from=esej&essayId=e1',
    );
  });

  it('works with an empty query', () => {
    render(<BookNotFoundCard query="" from="hledat" />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/cteni/knihy/nova?from=hledat');
  });
});
