import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyBooksMenu } from './copy-books-menu';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

import { toast } from 'sonner';

const writeText = vi.fn().mockResolvedValue(undefined);

function mockClipboard() {
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

async function openMenuAndCopy() {
  const user = userEvent.setup();
  // userEvent.setup() installs its own navigator.clipboard — re-apply ours after it.
  mockClipboard();
  render(<CopyBooksMenu />);
  await user.click(screen.getByRole('button', { name: 'Možnosti seznamu knih' }));
  await user.click(await screen.findByText('Kopírovat ověřené knihy'));
}

describe('CopyBooksMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClipboard();
  });

  it('fetches the shortlist and copies grouped plain text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ title_cs: 'Sprint', author: 'Jake Knapp', tags: ['Komunikace & prodej'], book_points: 2, essay_count: 4 }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await openMenuAndCopy();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/books?status=shortlist&sort=popular&page_size=500'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('Ověřené knihy (1)');
    expect(copied).toContain('- Sprint – Jake Knapp (2 body, 4 eseje)');
    expect(toast.success).toHaveBeenCalledWith('Seznam knih zkopírován do schránky');

    vi.unstubAllGlobals();
  });

  it('shows an error toast when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    await openMenuAndCopy();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Kopírování se nezdařilo'));
    expect(writeText).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
