import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ContentSourceReviewList } from './content-source-review-list';
import type { ContentSource } from '@/lib/content-sources/types';

const fetchSpy = vi.spyOn(globalThis, 'fetch');

const pending: ContentSource[] = [{
  id: 'src-1',
  kind: 'podcast',
  title: 'Founders',
  creator: 'David Senra',
  description: null,
  external_url: null,
  points: 0.5,
  status: 'pending_review',
  status_changed_at: null,
  status_changed_by_profile_id: null,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
  created_by_profile_id: 'profile-1',
  updated_by_profile_id: 'profile-1',
}];

beforeEach(() => {
  fetchSpy.mockReset();
});

describe('ContentSourceReviewList', () => {
  it('approves a pending source with its self-assigned points', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    const user = userEvent.setup();

    render(<ContentSourceReviewList initialPending={pending} />);
    await user.click(screen.getByRole('button', { name: 'Schválit' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/content-sources/src-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'approved', points: 0.5 }),
        }),
      );
    });
    expect(screen.queryByText('Founders')).not.toBeInTheDocument();
  });

  it('archives a pending source', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    const user = userEvent.setup();

    render(<ContentSourceReviewList initialPending={pending} />);
    await user.click(screen.getByRole('button', { name: 'Zamítnout' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/content-sources/src-1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });
});
