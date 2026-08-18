import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonalityTestTimeline } from '@/components/personality-tests/personality-test-timeline';
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

describe('PersonalityTestTimeline', () => {
  it('renders the owner empty state with the upload CTA and no viewer copy', () => {
    render(<PersonalityTestTimeline initialTests={[]} profileId="profile-1" isOwnProfile />);

    expect(screen.getByText('Zatím nemáš nahraný žádný osobnostní test')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Nahraj výsledky svého osobnostního testu jako soubor PDF nebo obrázek. Timeline ukáže, jak se v průběhu studia vyvíjíš.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nahrát test' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Zatím žádné osobnostní testy')).not.toBeInTheDocument();
    expect(screen.queryByText('Tato osoba zatím nenahrála žádné osobnostní testy.')).not.toBeInTheDocument();
  });

  it('renders the viewer empty state without any action buttons', () => {
    render(<PersonalityTestTimeline initialTests={[]} profileId="profile-1" isOwnProfile={false} />);

    expect(screen.getByText('Zatím žádné osobnostní testy')).toBeInTheDocument();
    expect(screen.getByText('Tato osoba zatím nenahrála žádné osobnostní testy.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nahrát test' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upravit test' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Smazat test' })).not.toBeInTheDocument();
  });

  it('lists tests newest first with type, date, file name and size; owner gets full actions', () => {
    const newest = testRow({ id: 'test-2', test_type: 'mbti' });
    const older = testRow({ id: 'test-1', test_type: 'gallup', tested_on: '2025-11-02' });
    render(
      <PersonalityTestTimeline initialTests={[older, newest]} profileId="profile-1" isOwnProfile />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    const first = items[0].textContent ?? '';
    expect(first).toContain('MBTI');
    expect(first).toContain('15. 3. 2026');
    expect(first).toContain('mbti-report.pdf');
    expect(first).toContain('1,4 MB');
    expect(items[1].textContent).toContain('Gallup');
    expect(items[1].textContent).toContain('2. 11. 2025');

    expect(screen.getAllByRole('link', { name: 'Otevřít' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Upravit test' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Smazat test' })).toHaveLength(2);
  });

  it('gives a viewer only the open link', () => {
    render(<PersonalityTestTimeline initialTests={[testRow()]} profileId="profile-1" isOwnProfile={false} />);

    expect(screen.getByRole('link', { name: 'Otevřít' })).toHaveAttribute(
      'href',
      '/api/personality-tests/test-1/open',
    );
    expect(screen.queryByRole('button', { name: 'Upravit test' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Smazat test' })).not.toBeInTheDocument();
  });

  it('deletes a test after confirming and removes it from the timeline', async () => {
    const row = testRow();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const user = userEvent.setup();
    render(<PersonalityTestTimeline initialTests={[row]} profileId="profile-1" isOwnProfile />);

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
    render(<PersonalityTestTimeline initialTests={[row]} profileId="profile-1" isOwnProfile />);

    await user.click(screen.getByRole('button', { name: 'Smazat test' }));
    expect(screen.getByText('Odstranit test?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Odstranit' }));

    await waitFor(() => expect(error).toHaveBeenCalledWith('Nepodařilo se odstranit test'));
    expect(screen.getByText('Odstranit test?')).toBeInTheDocument();
    // Radix marks DOM outside the open modal dialog aria-hidden, which hides it
    // from role queries but not text queries — the test is still there.
    expect(screen.getByText(/mbti-report\.pdf/)).toBeInTheDocument();
  });
});
