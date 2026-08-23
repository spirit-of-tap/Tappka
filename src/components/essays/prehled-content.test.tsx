import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrehledContent } from './prehled-content';
import { TooltipProvider } from '@/components/ui/tooltip';

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

describe('PrehledContent', () => {
  const defaultProps = {
    stats: {
      approved_points: 24,
      pending_points: 6,
      essay_count: 8,
      approved_points_this_semester: 12,
    },
    myEssays: [],
    drafts: [],
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
    expect(screen.getByText('Tým a BookPoints')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Detail týmu/i })).toHaveAttribute(
      'href',
      '/komunita/tymy/team-1?tab=statistiky',
    );
  });

  it('hides team section if user has no team', () => {
    render(
      <TooltipProvider>
        <PrehledContent {...defaultProps} hasTeam={false} teamId={null} />
      </TooltipProvider>,
    );

    expect(screen.queryByText('Tým a BookPoints')).not.toBeInTheDocument();
  });
});
