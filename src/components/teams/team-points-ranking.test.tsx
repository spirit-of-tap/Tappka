import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TeamPointsRanking } from './team-points-ranking';

const member = (id: string, name: string, approved: number, pending: number) => ({
  profile: { id, name, picture: null },
  approved_points: approved,
  pending_points: pending,
});

describe('TeamPointsRanking', () => {
  it('ranks members by total points and labels the viewer as "Ty"', () => {
    render(
      <TeamPointsRanking
        goal={120}
        currentProfileId="me"
        stats={[
          member('a', 'Anna Malá', 10, 0),
          member('me', 'Ondřej Kulhavý', 20, 4),
          member('b', 'Bára Velká', 30, 0),
        ]}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^1\..*Bára V\./),
      expect.stringMatching(/^2\..*Ty/),
      expect.stringMatching(/^3\..*Anna M\./),
    ]);
    expect(within(rows[1]).getByText('+4')).toBeInTheDocument();
  });

  it('describes each bar for assistive tech', () => {
    render(<TeamPointsRanking goal={120} stats={[member('a', 'Anna Malá', 10, 2)]} />);

    expect(
      screen.getByRole('img', { name: '10 schválených a 2 čekajících bodů z 120' }),
    ).toBeInTheDocument();
  });

  it('shows a short note for an empty team', () => {
    render(<TeamPointsRanking goal={120} stats={[]} />);
    expect(screen.getByText('Tým zatím nemá žádné členy:ky.')).toBeInTheDocument();
  });
});
