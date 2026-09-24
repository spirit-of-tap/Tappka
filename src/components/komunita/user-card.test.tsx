import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserCard } from '@/components/komunita/user-card';
import type { ProfileWithTeam } from '@/lib/komunita/types';

function createMockProfile(overrides: Partial<ProfileWithTeam> = {}): ProfileWithTeam {
  return {
    id: 'p-1',
    user_id: 'u-1',
    name: 'Jan Novák',
    work_email: 'jan.novak@example.com',
    personal_email: null,
    phone_number: null,
    date_of_birth: null,
    picture: null,
    bio_json: null,
    role: 'student',
    team_id: 'team-1',
    former_team_id: null,
    team_left_at: null,
    team_removed_by_profile_id: null,
    access_removed_at: null,
    access_removed_by_profile_id: null,
    beta_access_granted_at: null,
    beta_cohort: 'A',
    created_at: '2026-01-01T00:00:00Z',
    created_by_profile_id: null,
    updated_at: '2026-01-01T00:00:00Z',
    updated_by_profile_id: null,
    team: {
      id: 'team-1',
      name: 'Tuuli',
      color: '#ff0000',
      picture: null,
      group_picture: null,
      website_url: null,
      instagram_url: null,
      linkedin_url: null,
      ico: null,
      onboardingYear: 2025,
      removed_at: null,
      created_at: '2025-09-01T00:00:00Z',
      updated_at: '2025-09-01T00:00:00Z',
      created_by_profile_id: null,
      updated_by_profile_id: null,
    },
    ...overrides,
  };
}

describe('UserCard', () => {
  it('renders team name badge by default (showTeam=true)', () => {
    const profile = createMockProfile();
    render(<UserCard profile={profile} pictureUrl={null} />);

    expect(screen.getByText('Jan Novák')).toBeInTheDocument();
    expect(screen.getByText('Student:ka')).toBeInTheDocument();
    expect(screen.getByText('Tuuli')).toBeInTheDocument();
  });

  it('hides team name badge when showTeam is false', () => {
    const profile = createMockProfile();
    render(<UserCard profile={profile} pictureUrl={null} showTeam={false} />);

    expect(screen.getByText('Jan Novák')).toBeInTheDocument();
    expect(screen.getByText('Student:ka')).toBeInTheDocument();
    expect(screen.queryByText('Tuuli')).not.toBeInTheDocument();
  });

  it('includes from parameter in link href when provided', () => {
    const profile = createMockProfile();
    render(<UserCard profile={profile} pictureUrl={null} from="/komunita/tymy/team-1" />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/komunita/profil/p-1?from=%2Fkomunita%2Ftymy%2Fteam-1');
  });
});
