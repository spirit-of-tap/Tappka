import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContentSourceCard } from './content-source-card';
import type { ContentSource } from '@/lib/content-sources/types';

const source: ContentSource = {
  id: 'src-1',
  kind: 'podcast',
  title: 'Founders',
  creator: 'David Senra',
  description: null,
  external_url: null,
  points: 0.5,
  status: 'approved',
  status_changed_at: null,
  status_changed_by_profile_id: null,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
  created_by_profile_id: 'profile-1',
  updated_by_profile_id: 'profile-1',
};

describe('ContentSourceCard', () => {
  it('links to the content source detail page', () => {
    render(<ContentSourceCard source={source} />);
    expect(screen.getByRole('link', { name: /Founders/ })).toHaveAttribute('href', '/cteni/zdroje/src-1');
  });
});
