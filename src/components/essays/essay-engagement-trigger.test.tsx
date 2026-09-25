import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EssayEngagementTrigger } from './essay-engagement-trigger';

const fetchSpy = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  fetchSpy.mockReset();
});

describe('EssayEngagementTrigger', () => {
  const mockActivity = {
    isAuthor: true,
    views: [
      {
        viewer_profile_id: 'viewer-1',
        first_viewed_at: '2026-09-20T10:00:00Z',
        last_viewed_at: '2026-09-24T12:00:00Z',
        viewer: {
          id: 'viewer-1',
          name: 'Jan Novák',
          picture: null,
          role: 'student',
          team: { id: 'team-1', name: 'Alpha' },
        },
      },
    ],
    votes: [
      {
        voter_profile_id: 'voter-1',
        created_at: '2026-09-23T15:00:00Z',
        voter: {
          id: 'voter-1',
          name: 'Koučka Petra',
          picture: null,
          role: 'coach',
          team: null,
        },
      },
    ],
  };

  it('renders the view count button', () => {
    render(
      <EssayEngagementTrigger
        essayId="essay-1"
        viewCount={42}
        voteCount={7}
        isAuthor={false}
      />,
    );

    expect(screen.getByRole('button', { name: /Zobrazení: 42/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /To se mi líbí: 7/i })).not.toBeInTheDocument();
  });

  it('renders both view and vote count buttons when isAuthor is true', () => {
    render(
      <EssayEngagementTrigger
        essayId="essay-1"
        viewCount={42}
        voteCount={7}
        isAuthor={true}
      />,
    );

    expect(screen.getByRole('button', { name: /Zobrazení: 42/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /To se mi líbí: 7/i })).toBeInTheDocument();
  });

  it('opens dialog on view button click and shows viewers and voters', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockActivity), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const user = userEvent.setup();
    render(
      <EssayEngagementTrigger
        essayId="essay-1"
        viewCount={42}
        voteCount={7}
        isAuthor={true}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Zobrazení: 42/i }));

    expect(fetchSpy).toHaveBeenCalledWith('/api/essays/essay-1/activity');

    // Dialog title
    expect(await screen.findByText('Aktivita u eseje')).toBeInTheDocument();

    // Viewer Jan Novák should be visible
    expect(await screen.findByText('Jan Novák')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();

    // Click on "To se mi líbí" tab
    const votesTab = screen.getByRole('tab', { name: /To se mi líbí/i });
    await user.click(votesTab);

    // Voter Koučka Petra should be visible with coach badge
    expect(await screen.findByText('Koučka Petra')).toBeInTheDocument();
    expect(screen.getByText('Kouč:ka')).toBeInTheDocument();
  });

  it('opens directly to "To se mi líbí" tab when author clicks vote button', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockActivity), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const user = userEvent.setup();
    render(
      <EssayEngagementTrigger
        essayId="essay-1"
        viewCount={42}
        voteCount={7}
        isAuthor={true}
      />,
    );

    await user.click(screen.getByRole('button', { name: /To se mi líbí: 7/i }));

    // Should fetch activity
    expect(fetchSpy).toHaveBeenCalledWith('/api/essays/essay-1/activity');

    // Voter should immediately be visible in active tab
    expect(await screen.findByText('Koučka Petra')).toBeInTheDocument();
  });

  it('shows private notice for non-authors on the views tab', async () => {
    const nonAuthorActivity = {
      isAuthor: false,
      views: [],
      votes: mockActivity.votes,
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(nonAuthorActivity), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const user = userEvent.setup();
    render(
      <EssayEngagementTrigger
        essayId="essay-1"
        viewCount={5}
        voteCount={2}
        isAuthor={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Zobrazení: 5/i }));

    expect(await screen.findByText('Soukromý přehled')).toBeInTheDocument();
    expect(
      screen.getByText(/Seznam čtenářů a čtenářek vidí pouze autor:ka eseje/i),
    ).toBeInTheDocument();
  });

  it('shows empty states when there are no views and no votes', async () => {
    const emptyActivity = {
      isAuthor: true,
      views: [],
      votes: [],
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(emptyActivity), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const user = userEvent.setup();
    render(
      <EssayEngagementTrigger
        essayId="essay-1"
        viewCount={0}
        voteCount={0}
        isAuthor={true}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Zobrazení: 0/i }));

    expect(await screen.findByText('Zatím žádná zobrazení')).toBeInTheDocument();

    const votesTab = screen.getByRole('tab', { name: /To se mi líbí/i });
    await user.click(votesTab);

    expect(await screen.findByText('Zatím žádné to se mi líbí')).toBeInTheDocument();
  });
});
