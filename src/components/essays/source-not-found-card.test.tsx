import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SourceNotFoundCard } from './source-not-found-card';

describe('SourceNotFoundCard', () => {
  it('links to both add-book and add-source flows, carrying the query and essayId back', () => {
    render(<SourceNotFoundCard query="Founders" essayId="essay-1" />);

    expect(screen.getByRole('link', { name: /Přidat knihu/ })).toHaveAttribute(
      'href',
      '/cteni/knihy/nova?q=Founders&from=esej&essayId=essay-1',
    );
    expect(screen.getByRole('link', { name: /Přidat jiný zdroj/ })).toHaveAttribute(
      'href',
      '/cteni/zdroje/nova?q=Founders&from=esej&essayId=essay-1',
    );
  });

  it('omits essayId when not provided (new-essay flow)', () => {
    render(<SourceNotFoundCard query="Founders" />);

    expect(screen.getByRole('link', { name: /Přidat knihu/ })).toHaveAttribute(
      'href',
      '/cteni/knihy/nova?q=Founders&from=esej',
    );
  });
});
