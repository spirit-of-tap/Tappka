import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrehledContent } from './prehled-content';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { EssayWithDetails } from '@/lib/essays/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe('PrehledContent', () => {
  const defaultProps = {
    stats: {
      approved_points: 24,
      pending_points: 6,
      essay_count: 8,
      approved_points_this_semester: 12,
    },
    myEssays: [],
    votedEssayIds: new Set<string>(),
    loans: [],
  };

  it('shows the path hero, the shelf and the essays', () => {
    render(
      <TooltipProvider>
        <PrehledContent {...defaultProps} />
      </TooltipProvider>,
    );

    expect(screen.getByRole('heading', { name: /Cesta \d\. semestrem/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Právě čtu' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Moje eseje' })).toBeInTheDocument();
    expect(screen.getByText('Zatím žádná esej')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Tým/ })).not.toBeInTheDocument();
  });

  it('always shows the team ranking when there is a team', () => {
    render(
      <TooltipProvider>
        <PrehledContent
          {...defaultProps}
          currentProfileId="me"
          teamName="Alfa"
          teamStats={[
            { profile: { id: 'me', name: 'Ondřej Kulhavý', picture: null }, approved_points: 12, pending_points: 0 },
            { profile: { id: 'p2', name: 'Jan Novák', picture: null }, approved_points: 30, pending_points: 5 },
          ]}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Tým Alfa · body' })).toBeInTheDocument();
    expect(screen.getByText('Jan N.')).toBeVisible();
    expect(screen.getByText('Ty')).toBeVisible();
  });

  describe('semester number', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("derives the semester from the team's onboarding year", () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-15T12:00:00'));

      render(
        <TooltipProvider>
          <PrehledContent {...defaultProps} onboardingYear={2026} />
        </TooltipProvider>,
      );

      expect(screen.getByRole('heading', { name: 'Cesta 1. semestrem' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Cesta 3. semestrem' })).not.toBeInTheDocument();
    });
  });

  describe('my essays search', () => {
    const essay = (id: string, title: string): EssayWithDetails =>
      ({
        id,
        title,
        content_text: '',
        created_at: '2026-09-01T00:00:00Z',
        vote_count: 0,
        view_count: 0,
        comment_count: 0,
        book: null,
        content_source: null,
      }) as unknown as EssayWithDetails;

    const renderWithEssays = () =>
      render(
        <TooltipProvider>
          <PrehledContent
            {...defaultProps}
            myEssays={[essay('a', 'Vedení týmu'), essay('b', 'Úvaha o čase')]}
          />
        </TooltipProvider>,
      );

    it('keeps the search collapsed behind an icon until opened', async () => {
      const user = userEvent.setup();
      renderWithEssays();

      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Hledat v mých esejích' }));
      expect(screen.getByRole('searchbox')).toHaveFocus();
    });

    it('filters essays and shows an empty state when nothing matches', async () => {
      const user = userEvent.setup();
      renderWithEssays();

      await user.click(screen.getByRole('button', { name: 'Hledat v mých esejích' }));
      await user.type(screen.getByRole('searchbox'), 'tymu');
      expect(screen.getByText('Vedení týmu')).toBeInTheDocument();
      expect(screen.queryByText('Úvaha o čase')).not.toBeInTheDocument();

      await user.clear(screen.getByRole('searchbox'));
      await user.type(screen.getByRole('searchbox'), 'xyz');
      expect(screen.getByText('Nic nenalezeno')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.getByText('Úvaha o čase')).toBeInTheDocument();
    });
  });
});
