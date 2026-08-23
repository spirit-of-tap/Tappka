import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonalityTestsView } from '@/components/personality-tests/personality-tests-view';
import type { PersonalityTest } from '@/lib/personality-tests/types';

const { error, success } = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error, success } }));

function testRow(overrides: Partial<PersonalityTest> = {}): PersonalityTest {
  return {
    id: 'test-1',
    profile_id: 'profile-1',
    test_type: 'mbti',
    test_type_other: null,
    tested_on: '2026-03-15',
    file_path: 'personality-test/test-1/report.pdf',
    file_name: 'mbti-report.pdf',
    file_size: 1_500_000,
    created_at: '2026-03-16T10:00:00Z',
    updated_at: '2026-03-16T10:00:00Z',
    created_by_profile_id: 'profile-1',
    updated_by_profile_id: 'profile-1',
    removed_at: null,
    ...overrides,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  error.mockReset();
  success.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PersonalityTestsView', () => {
  it('renders page header and empty state with the upload CTA', () => {
    render(<PersonalityTestsView tests={[]} profileId="profile-1" />);

    expect(screen.getByRole('heading', { name: 'Osobnostní testy' })).toBeInTheDocument();
    expect(screen.getByText('Zatím nemáš nahraný žádný osobnostní test')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Nahraj výsledky svého osobnostního testu jako soubor PDF nebo obrázek. Časová osa ukáže, jak se v průběhu studia vyvíjíš.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nahrát test' }).length).toBeGreaterThan(0);
  });

  it('lists tests grouped by semester with type, date, size (without raw file name) and actions', () => {
    const newest = testRow({ id: 'test-2', test_type: 'mbti', tested_on: '2026-03-15' });
    const older = testRow({ id: 'test-1', test_type: 'gallup', tested_on: '2025-11-02' });
    render(
      <PersonalityTestsView tests={[older, newest]} profileId="profile-1" onboardingYear={2025} />,
    );

    expect(screen.getByText(/Letní semestr — 1\. ročník \(2025\/2026\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Zimní semestr — 1\. ročník \(2025\/2026\)/i)).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    const first = items[0].textContent ?? '';
    expect(first).toContain('MBTI');
    expect(first).toContain('15. 3. 2026');
    expect(first).toContain('1,4 MB');
    expect(first).not.toContain('mbti-report.pdf');

    expect(items[1].textContent).toContain('Gallup');
    expect(items[1].textContent).toContain('2. 11. 2025');

    expect(screen.getAllByRole('link', { name: 'Otevřít' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Upravit test' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Smazat test' })).toHaveLength(2);
  });

  it('deletes a test after confirming and removes it from the list', async () => {
    const row = testRow();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const user = userEvent.setup();
    render(<PersonalityTestsView tests={[row]} profileId="profile-1" />);

    await user.click(screen.getByRole('button', { name: 'Smazat test' }));
    expect(screen.getByText('Odstranit test?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Odstranit' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/personality-tests/${row.id}`, { method: 'DELETE' }),
    );
    await waitFor(() => expect(success).toHaveBeenCalledWith('Test odstraněn'));
    await waitFor(() => expect(screen.queryByRole('listitem')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('Odstranit test?')).not.toBeInTheDocument());
  });

  it('keeps the dialog open and the test listed when deletion fails', async () => {
    const row = testRow();
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Nepodařilo se odstranit test' }),
    });
    const user = userEvent.setup();
    render(<PersonalityTestsView tests={[row]} profileId="profile-1" />);

    await user.click(screen.getByRole('button', { name: 'Smazat test' }));
    expect(screen.getByText('Odstranit test?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Odstranit' }));

    await waitFor(() => expect(error).toHaveBeenCalledWith('Nepodařilo se odstranit test'));
    expect(screen.getByText('Odstranit test?')).toBeInTheDocument();
    expect(screen.getAllByText('MBTI').length).toBeGreaterThan(0);
  });
});
