import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KomunitaContent } from '@/components/komunita/komunita-content';
import type { ProfileWithTeam } from '@/lib/komunita/types';

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
    preferred_name: null,
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
      name: 'Aktivní Tým',
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
      group_picture: null,
      website_url: null,
      instagram_url: null,
      linkedin_url: null,
      ico: null,
      onboardingYear: 2020,
      removed_at: '2023-06-30T00:00:00Z',
      created_at: '2020-09-01T00:00:00Z',
      updated_at: '2023-06-30T00:00:00Z',
      created_by_profile_id: null,
      updated_by_profile_id: null,
    },
  });

  const leftTeamProfile = createMockProfile({
    id: 'p-left',
    name: 'Odešlý Student',
    work_email: 'odesly@tap.cz',
    team_id: null,
    former_team_id: 'team-old',
    team_left_at: '2024-06-30T00:00:00Z',
    team: null,
  });

  it('shows the selected team members in the panel and staff as a neutral bubble', () => {
    render(
      <KomunitaContent
        profiles={[activeProfile, coachWithoutTeam]}
        pictureUrls={{}}
      />,
    );

    expect(screen.getByText('Aktivní Student')).toBeInTheDocument();
    expect(screen.queryByText('Kouč Bez Týmu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kouči:ky a vedení, 1 člověk' })).toBeInTheDocument();
    expect(screen.queryByText(/Už nestudující/)).not.toBeInTheDocument();
  });

  it('selects the viewer team by default and switches on bubble click', async () => {
    const user = userEvent.setup();
    const other = createMockProfile({
      id: 'p-other',
      name: 'Jiný Člen',
      team_id: 'team-2',
      team: { ...activeProfile.team!, id: 'team-2', name: 'Druhý Tým' },
    });
    render(
      <KomunitaContent
        profiles={[activeProfile, other, coachWithoutTeam]}
        pictureUrls={{}}
        viewerTeamId="team-2"
      />,
    );

    const second = screen.getByRole('button', { name: 'Tým Druhý Tým, 1 člověk' });
    const first = screen.getByRole('button', { name: 'Tým Aktivní Tým, 1 člověk' });
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Jiný Člen')).toBeInTheDocument();
    expect(screen.queryByText('Aktivní Student')).not.toBeInTheDocument();

    await user.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Aktivní Student')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Detail týmu →' })).toHaveAttribute('href', '/komunita/tymy/team-1');
  });

  it('collapses students who left their team into the alumni section by default', () => {
    render(
      <KomunitaContent
        profiles={[activeProfile, leftTeamProfile]}
        pictureUrls={{}}
      />,
    );

    expect(screen.getByText('Aktivní Student')).toBeInTheDocument();
    expect(screen.queryByText('Odešlý Student')).not.toBeInTheDocument();
    expect(screen.getByText('Už nestudující')).toBeInTheDocument();
    expect(screen.getByText('(1)')).toBeInTheDocument();
  });

  it('collapses students from archived teams into the same section', () => {
    render(
      <KomunitaContent
        profiles={[activeProfile, oldTeamProfile]}
        pictureUrls={{}}
      />,
    );

    expect(screen.getByText('Aktivní Student')).toBeInTheDocument();
    expect(screen.queryByText('Absolvent Starý')).not.toBeInTheDocument();
    expect(screen.getByText('Už nestudující')).toBeInTheDocument();
  });

  it('expands and collapses alumni when clicking the toggle', async () => {
    const user = userEvent.setup();
    render(
      <KomunitaContent
        profiles={[activeProfile, oldTeamProfile, leftTeamProfile]}
        pictureUrls={{}}
      />,
    );

    const toggleButton = screen.getByRole('button', {
      name: /Už nestudující/,
    });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Absolvent Starý')).not.toBeInTheDocument();

    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Absolvent Starý')).toBeInTheDocument();
    expect(screen.getByText('Odešlý Student')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();

    await user.click(toggleButton);
    expect(screen.queryByText('Absolvent Starý')).not.toBeInTheDocument();
  });

  it('finds an alumnus directly when searching', async () => {
    const user = userEvent.setup();
    render(
      <KomunitaContent
        profiles={[activeProfile, leftTeamProfile]}
        pictureUrls={{}}
      />,
    );

    await user.type(
      screen.getByPlaceholderText('Hledat podle jména nebo emailu…'),
      'Odešlý',
    );

    expect(screen.getByText('Odešlý Student')).toBeInTheDocument();
    expect(screen.queryByText(/Už nestudující/)).not.toBeInTheDocument();
  });

  it('dims bubbles without a match and lists results with the team', async () => {
    const user = userEvent.setup();
    const other = createMockProfile({
      id: 'p-other',
      name: 'Jiný Člen',
      team_id: 'team-2',
      team: { ...activeProfile.team!, id: 'team-2', name: 'Druhý Tým' },
    });
    render(<KomunitaContent profiles={[activeProfile, other, coachWithoutTeam]} pictureUrls={{}} />);

    await user.type(screen.getByPlaceholderText('Hledat podle jména nebo emailu…'), 'Jiný');

    expect(screen.getByText('Výsledky hledání')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Jiný Člen/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Aktivní Student/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tým Aktivní Tým, 1 člověk' })).toHaveClass('opacity-35');
    expect(screen.getByRole('button', { name: 'Tým Druhý Tým, 1 člověk' })).not.toHaveClass('opacity-35');
    expect(screen.queryByText(/Už nestudující/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Druhý Tým$/  }));
    expect(screen.queryByText('Výsledky hledání')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zpět na výsledky hledání' })).toBeInTheDocument();
  });

  it('matches teams by name', async () => {
    const user = userEvent.setup();
    render(<KomunitaContent profiles={[activeProfile, coachWithoutTeam]} pictureUrls={{}} />);

    await user.type(screen.getByPlaceholderText('Hledat podle jména nebo emailu…'), 'aktivni tym');

    expect(screen.getByRole('link', { name: /Aktivní Student/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kouči:ky a vedení, 1 člověk' })).toHaveClass('opacity-35');
  });

  it('shows empty state when no profiles match search', async () => {
    const user = userEvent.setup();
    render(
      <KomunitaContent
        profiles={[activeProfile]}
        pictureUrls={{}}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      'Hledat podle jména nebo emailu…',
    );
    await user.type(searchInput, 'Neznámé Jméno');

    expect(screen.getByText('Nikoho jsme nenašli')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Vymazat hledání' }).at(-1)!);
    expect(screen.queryByText('Nikoho jsme nenašli')).not.toBeInTheDocument();
  });
});
