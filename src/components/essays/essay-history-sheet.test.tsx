import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EssayHistorySheet } from '@/components/essays/essay-history-sheet';

vi.mock('@/components/essays/tiptap-renderer', () => ({
  TiptapRenderer: () => <div data-testid="rendered-revision" />,
}));

const fetchSpy = vi.spyOn(globalThis, 'fetch');

const revisions = [
  { revision_no: 3, title: 'Atomic Habits', created_at: '2026-08-10T09:00:00Z', updated_at: '2026-08-10T09:20:00Z', word_count: 1240, snippet: 'Kniha o návycích' },
  { revision_no: 2, title: 'Atomic Habits', created_at: '2026-08-09T19:00:00Z', updated_at: '2026-08-09T19:10:00Z', word_count: 980, snippet: 'Rozepsané' },
];

beforeEach(() => {
  fetchSpy.mockReset();
});

describe('EssayHistorySheet', () => {
  it('fetches nothing until it is opened', () => {
    render(<EssayHistorySheet essayId="essay-1" />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('lists revisions when opened', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: revisions }), { status: 200 }),
    );
    const user = userEvent.setup();

    render(<EssayHistorySheet essayId="essay-1" />);
    await user.click(screen.getByRole('button', { name: /Historie/ }));

    await waitFor(() => expect(screen.getByText('1 240 slov')).toBeInTheDocument());
    expect(screen.getByText('980 slov')).toBeInTheDocument();
  });

  it('marks the newest revision and shows how much it grew', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: revisions }), { status: 200 }),
    );
    const user = userEvent.setup();

    render(<EssayHistorySheet essayId="essay-1" />);
    await user.click(screen.getByRole('button', { name: /Historie/ }));

    await waitFor(() => expect(screen.getByText('Aktuální')).toBeInTheDocument());
    // 1240 − 980: the delta belongs to the newer of the two checkpoints.
    expect(screen.getByText('+260')).toBeInTheDocument();
  });

  it('groups checkpoints under a day heading', async () => {
    // Dated well in the past so the labels never become "Dnes"/"Včera".
    const oldRevisions = [
      { ...revisions[0], updated_at: '2020-03-05T09:20:00Z' },
      { ...revisions[1], updated_at: '2020-03-04T19:10:00Z' },
    ];
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: oldRevisions }), { status: 200 }),
    );
    const user = userEvent.setup();

    render(<EssayHistorySheet essayId="essay-1" />);
    await user.click(screen.getByRole('button', { name: /Historie/ }));

    await waitFor(() => expect(screen.getByText('5. března')).toBeInTheDocument());
    expect(screen.getByText('4. března')).toBeInTheDocument();
  });

  it('shows an empty state when there is only the current version', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const user = userEvent.setup();

    render(<EssayHistorySheet essayId="essay-1" />);
    await user.click(screen.getByRole('button', { name: /Historie/ }));

    await waitFor(() =>
      expect(screen.getByText('Zatím žádné starší verze.')).toBeInTheDocument(),
    );
  });
});