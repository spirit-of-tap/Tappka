import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import { WISHLIST_COPY, WishlistButton } from './wishlist-button';
import { WishlistProvider } from './wishlist-provider';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderButton(savedIds: string[] = []) {
  return render(
    <WishlistProvider initialSavedIds={savedIds}>
      <WishlistButton bookId="book-1" />
    </WishlistProvider>,
  );
}

describe('WishlistButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves an unsaved book optimistically', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    renderButton();

    const button = screen.getByRole('button', { name: 'Přidat do Chci si přečíst' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(button);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/books/book-1/wishlist', { method: 'POST' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Odebrat z Chci si přečíst' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(toast.success).toHaveBeenCalledWith(WISHLIST_COPY.toastAdded);
  });

  it('removes an already saved book', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    renderButton(['book-1']);

    await userEvent.click(screen.getByRole('button', { name: 'Odebrat z Chci si přečíst' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/books/book-1/wishlist', { method: 'DELETE' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Přidat do Chci si přečíst' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
    expect(toast.success).toHaveBeenCalledWith(WISHLIST_COPY.toastRemoved, {
      action: expect.objectContaining({ label: WISHLIST_COPY.toastUndo }),
    });
  });

  it('restores a removed book from the undo toast action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    renderButton(['book-1']);

    await userEvent.click(screen.getByRole('button', { name: 'Odebrat z Chci si přečíst' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    const options = vi.mocked(toast.success).mock.calls[0]?.[1] as
      | { action: { onClick: () => void } }
      | undefined;
    act(() => options?.action.onClick());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith('/api/books/book-1/wishlist', { method: 'POST' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Odebrat z Chci si přečíst' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('reverts the optimistic change when the request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    renderButton();

    await userEvent.click(screen.getByRole('button', { name: 'Přidat do Chci si přečíst' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Přidat do Chci si přečíst' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
    expect(toast.error).toHaveBeenCalledWith(WISHLIST_COPY.toastError);
  });
});
