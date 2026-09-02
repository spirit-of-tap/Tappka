import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KomunitaContent } from '@/components/komunita/komunita-content';
import type { ProfileWithTeam, TeamWithCount } from '@/lib/komunita/types';

function createMockProfile(
  overrides: Partial<ProfileWithTeam> = {},
): ProfileWithTeam {
  return {
    id: 'p-1',
    user_id: 'u-1',
    name: 'Jan Novák',
    work_email: 'jan.novak@example.com',
    personal_email: null,
    phone_number: null,
    date_of_birth: null,
    picture: null,
    role: 'student',
    team_id: 'team-1',
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
      name: 'Aktivní Tým',
      color: '#ff0000',
      picture: null,
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

function createMockTeam(overrides: Partial<TeamWithCount> = {}): TeamWithCount {
  return {
    id: 'team-1',
    name: 'Aktivní Tým',
    color: '#ff0000',
    picture: null,
    onboardingYear: 2025,
    removed_at: null,
    created_at: '2025-09-01T00:00:00Z',
    updated_at: '2025-09-01T00:00:00Z',
    created_by_profile_id: null,
    updated_by_profile_id: null,
    member_count: 1,
    ...overrides,
  };
}

describe('KomunitaContent', () => {
  const activeProfile = createMockProfile({
    id: 'p-active',
    name: 'Aktivní Student',
    work_email: 'aktivni@tap.cz',
  });

  const coachWithoutTeam = createMockProfile({
    id: 'p-coach',
    name: 'Kouč Bez Týmu',
    work_email: 'kouc@tap.cz',
    role: 'coach',
    team_id: null,
    team: null,
  });

  const oldTeamProfile = createMockProfile({
    id: 'p-old',
    name: 'Absolvent Starý',
    work_email: 'absolvent@tap.cz',
    team_id: 'team-old',
    team: {
      id: 'team-old',
      name: 'Starý Tým',
      color: '#888888',
      picture: null,
      onboardingYear: 2020,
      removed_at: '2023-06-30T00:00:00Z',
      created_at: '2020-09-01T00:00:00Z',
      updated_at: '2023-06-30T00:00:00Z',
      created_by_profile_id: null,
      updated_by_profile_id: null,
    },
  });

  it('renders active profiles and coach without team in the main grid', () => {
    render(
      <KomunitaContent
        profiles={[activeProfile, coachWithoutTeam]}
        pictureUrls={{}}
        teams={[createMockTeam()]}
      />,
    );

    expect(screen.getByText('Aktivní Student')).toBeInTheDocument();
    expect(screen.getByText('Kouč Bez Týmu')).toBeInTheDocument();
    expect(
      screen.queryByText(/Lidé ze starých týmů/),
    ).not.toBeInTheDocument();
  });

  it('hides people from old teams in a collapsed section by default', () => {
    render(
      <KomunitaContent
        profiles={[activeProfile, oldTeamProfile]}
        pictureUrls={{}}
        teams={[createMockTeam()]}
      />,
    );

    expect(screen.getByText('Aktivní Student')).toBeInTheDocument();
    expect(screen.queryByText('Absolvent Starý')).not.toBeInTheDocument();
    expect(screen.getByText('Lidé ze starých týmů')).toBeInTheDocument();
    expect(screen.getByText('(1)')).toBeInTheDocument();
  });

  it('expands and collapses old team members when clicking the toggle', async () => {
    const user = userEvent.setup();
    render(
      <KomunitaContent
        profiles={[activeProfile, oldTeamProfile]}
        pictureUrls={{}}
        teams={[createMockTeam()]}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: /Lidé ze starých týmů/,
    });
    expect(screen.queryByText('Absolvent Starý')).not.toBeInTheDocument();

    await user.click(toggleButton);
    expect(screen.getByText('Absolvent Starý')).toBeInTheDocument();

    await user.click(toggleButton);
    expect(screen.queryByText('Absolvent Starý')).not.toBeInTheDocument();
  });

  it('filters people when searching by query', async () => {
    const user = userEvent.setup();
    render(
      <KomunitaContent
        profiles={[activeProfile, coachWithoutTeam, oldTeamProfile]}
        pictureUrls={{}}
        teams={[createMockTeam()]}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      'Hledat podle jména nebo emailu…',
    );
    await user.type(searchInput, 'Kouč');

    expect(screen.getByText('Kouč Bez Týmu')).toBeInTheDocument();
    expect(screen.queryByText('Aktivní Student')).not.toBeInTheDocument();
    expect(screen.queryByText('Lidé ze starých týmů')).not.toBeInTheDocument();
  });

  it('shows empty state when no profiles match search', async () => {
    const user = userEvent.setup();
    render(
      <KomunitaContent
        profiles={[activeProfile]}
        pictureUrls={{}}
        teams={[createMockTeam()]}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      'Hledat podle jména nebo emailu…',
    );
    await user.type(searchInput, 'Neznámé Jméno');

    expect(screen.getByText('Nikoho jsme nenašli')).toBeInTheDocument();
  });
});
