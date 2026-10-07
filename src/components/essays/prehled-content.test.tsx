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

// Mock recharts ResponsiveContainer since it needs DOM size calculations
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 500, height: 300 }}>{children}</div>
    ),
  };
});

// The semester number and label render as separate text nodes inside one span.
const semesterLabel = (text: string) => (_: string, el: Element | null) =>
  el?.tagName === 'SPAN' && el.textContent === text;

describe('PrehledContent', () => {
  const defaultProps = {
    stats: {
      approved_points: 24,
      pending_points: 6,
      essay_count: 8,
      approved_points_this_semester: 12,
    },
    myEssays: [],
    teamStats: [
      {
        profile: { id: 'user-1', name: 'Jan Novák', picture: null },
        approved_points: 30,
        pending_points: 5,
      },
    ],
    hasTeam: true,
    teamId: 'team-1',
    votedEssayIds: new Set<string>(),
    loans: [],
  };

  it('renders progress, essays empty state, and team book points section', () => {
    render(
      <TooltipProvider>
        <PrehledContent {...defaultProps} />
      </TooltipProvider>,
    );

    expect(screen.getByText('Moje eseje')).toBeInTheDocument();
    expect(screen.getByText('Ještě tu nic není')).toBeInTheDocument();
    expect(screen.getByText('Tým a knižní body')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Detail týmu/i })).toHaveAttribute(
      'href',
      '/komunita/tymy/team-1?tab=statistiky',
    );
  });

  it('anchors the team section so the dashboard widget can deep-link to it', () => {
    render(
      <TooltipProvider>
        <PrehledContent {...defaultProps} />
      </TooltipProvider>,
    );

    expect(screen.getByRole('region', { name: 'Tým a knižní body' })).toHaveAttribute(
      'id',
      'tym-a-knizni-body',
    );
  });

  it('hides team section if user has no team', () => {
    render(
      <TooltipProvider>
        <PrehledContent {...defaultProps} hasTeam={false} teamId={null} />
      </TooltipProvider>,
    );

    expect(screen.queryByText('Tým a knižní body')).not.toBeInTheDocument();
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

      expect(screen.getAllByText(semesterLabel('1. semestr')).length).toBeGreaterThan(0);
      expect(screen.queryByText(semesterLabel('3. semestr'))).not.toBeInTheDocument();
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
