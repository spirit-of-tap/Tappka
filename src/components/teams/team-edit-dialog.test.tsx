import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';

import { TeamEditDialog } from './team-edit-dialog';
import type { Team } from '@/lib/komunita/types';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const MOCK_TEAM: Team = {
  id: 'team-123',
  name: 'Tuuli',
  color: '#ff4444',
  picture: 'avatars/tuuli-logo.png',
  group_picture: 'avatars/tuuli-group.png',
  website_url: 'https://tuuli.cz',
  instagram_url: '@tuuliteam',
  linkedin_url: 'https://linkedin.com/company/tuuli',
  ico: '12345678',
  onboardingYear: 2025,
  removed_at: null,
  created_at: '2025-09-01T00:00:00Z',
  updated_at: '2025-09-01T00:00:00Z',
  created_by_profile_id: null,
  updated_by_profile_id: null,
};

describe('TeamEditDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders edit button and opens dialog with prefilled values', async () => {
    const user = userEvent.setup();
    render(<TeamEditDialog team={MOCK_TEAM} />);

    const button = screen.getByRole('button', { name: /upravit tým/i });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12345678')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://tuuli.cz')).toBeInTheDocument();
    expect(screen.getByDisplayValue('@tuuliteam')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://linkedin.com/company/tuuli')).toBeInTheDocument();
  });

  it('shows error toast when saving invalid IČO', async () => {
    const user = userEvent.setup();
    render(<TeamEditDialog team={MOCK_TEAM} />);

    await user.click(screen.getByRole('button', { name: /upravit tým/i }));

    const icoInput = screen.getByLabelText(/ičo/i);
    await user.clear(icoInput);
    await user.type(icoInput, '123');

    await user.click(screen.getByRole('button', { name: /uložit změny/i }));

    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/8 číslic/));
  });

  it('saves updated team information via PATCH', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ team: { ...MOCK_TEAM, website_url: 'https://novy-web.cz' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<TeamEditDialog team={MOCK_TEAM} />);

    await user.click(screen.getByRole('button', { name: /upravit tým/i }));

    const webInput = screen.getByLabelText(/webové stránky/i);
    await user.clear(webInput);
    await user.type(webInput, 'https://novy-web.cz');

    await user.click(screen.getByRole('button', { name: /uložit změny/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/teams/team-123',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('https://novy-web.cz'),
        })
      );
    });

    expect(toast.success).toHaveBeenCalledWith('Údaje týmu byly úspěšně uloženy.');
    expect(refreshMock).toHaveBeenCalled();
  });
});
