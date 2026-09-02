import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-barcode-scanner', () => ({
  BarcodeScanner: ({
    options,
    onCapture,
  }: {
    options: { formats: string[] };
    onCapture: (barcodes: Array<{ rawValue: string; format: string }>) => void;
  }) => {
    const scansQrCode = options.formats.includes('qr_code');
    return (
      <button
        type="button"
        onClick={() => onCapture([{
          rawValue: scansQrCode ? 'https://tiimi.cz/l/7' : '9788027504376',
          format: scansQrCode ? 'qr_code' : 'ean_13',
        }])}
      >
        {scansQrCode ? 'test-scan-label' : 'test-scan-isbn'}
      </button>
    );
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { LibraryLabelAssignment } from './library-label-assignment';

const BOOK = {
  id: 'book-1',
  title_cs: 'Atomové návyky',
  author: 'James Clear',
  isbn_13: '9788027504376',
  google_books_cover_url: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LibraryLabelAssignment', () => {
  it('reads a Tappka label URL and advances to book selection', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<LibraryLabelAssignment initialLabelCode={null} />);
    await user.click(screen.getByRole('button', { name: 'test-scan-label' }));

    expect(await screen.findByText('#007')).toBeInTheDocument();
    expect(await screen.findByText('2. Kniha')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/library/labels/7');
  });

  it('searches the catalogue and assigns the selected book to the copy', async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/library/labels/7' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            data: { id: 'copy-1', book_id: BOOK.id, label_code: 7, book: BOOK },
          }),
        } as Response);
      }
      if (url === '/api/library/labels/7') {
        return Promise.resolve({ ok: false, status: 404 } as Response);
      }
      if (url.startsWith('/api/books/search')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: [BOOK] }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<LibraryLabelAssignment initialLabelCode={7} />);
    await screen.findByText('2. Kniha');

    await user.type(screen.getByRole('textbox', { name: 'Hledat knihu' }), 'Atomové návyky');
    await user.click(screen.getByRole('button', { name: 'Hledat' }));
    await screen.findByText('James Clear');
    await user.click(screen.getByRole('button', { name: 'Přiřadit' }));

    expect(await screen.findByText('Výtisk je připravený')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/library/labels/7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: BOOK.id }),
    }));
  });
});
