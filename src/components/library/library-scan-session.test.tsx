import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-barcode-scanner', () => ({
  BarcodeScanner: ({
    onCapture,
  }: {
    onCapture: (barcodes: Array<{ rawValue: string; format: string }>) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onCapture([{ rawValue: 'https://tiimi.cz/l/7', format: 'qr_code' }])
        }
      >
        scan-paired
      </button>
      <button
        type="button"
        onClick={() =>
          onCapture([{ rawValue: 'https://tiimi.cz/l/12', format: 'qr_code' }])
        }
      >
        scan-unpaired
      </button>
      <button
        type="button"
        onClick={() => onCapture([{ rawValue: 'https://example.com/menu', format: 'qr_code' }])}
      >
        scan-not-a-label
      </button>
    </div>
  ),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/lib/library/scan-feedback', () => ({
  primeScanAudio: vi.fn(),
  playScanFeedback: vi.fn(),
}));

import { toast } from 'sonner';

import { playScanFeedback } from '@/lib/library/scan-feedback';

import { RESCAN_COOLDOWN_MS } from '@/lib/library/scan-session';

import { LibraryScanSession } from './library-scan-session';

const LABELS = [{ code: 7, title: 'Atomové návyky' }];

let now = 1_000;

beforeEach(() => {
  now = 1_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.warning).mockReset();
  vi.mocked(playScanFeedback).mockReset();
});

async function openScanner(labels = LABELS) {
  const user = userEvent.setup();
  render(<LibraryScanSession labels={labels} />);
  await user.click(screen.getByRole('button', { name: 'Živé skenování' }));
  return user;
}

describe('LibraryScanSession', () => {
  it('reports a paired label with the book title', async () => {
    const user = await openScanner();

    await user.click(screen.getByRole('button', { name: 'scan-paired' }));

    expect(toast.success).toHaveBeenCalledWith('Přiřazeno: #007 — Atomové návyky');
    expect(playScanFeedback).toHaveBeenCalledWith('paired');
    expect(screen.getByTestId('scan-count-paired')).toHaveTextContent('1');
    expect(screen.getByTestId('scan-last-result')).toHaveTextContent('Přiřazeno');
    expect(screen.getByTestId('scan-last-result')).toHaveTextContent('Atomové návyky');
  });

  it('reports a label that is not paired with any book', async () => {
    const user = await openScanner();

    await user.click(screen.getByRole('button', { name: 'scan-unpaired' }));

    expect(toast.warning).toHaveBeenCalledWith('Štítek #012 není přiřazený');
    expect(playScanFeedback).toHaveBeenCalledWith('unpaired');
    expect(screen.getByTestId('scan-count-unpaired')).toHaveTextContent('1');
    expect(screen.getByTestId('scan-last-result')).toHaveTextContent('Nepřiřazeno');
  });

  it('warns about a QR code that is not a library label and does not count it', async () => {
    const user = await openScanner();

    await user.click(screen.getByRole('button', { name: 'scan-not-a-label' }));

    expect(toast.warning).toHaveBeenCalledWith('Tenhle QR kód není knihovní štítek');
    expect(screen.getByTestId('scan-count-total')).toHaveTextContent('0');
  });

  it('does not report the same label twice while it stays in frame', async () => {
    const user = await openScanner();

    await user.click(screen.getByRole('button', { name: 'scan-paired' }));
    now += RESCAN_COOLDOWN_MS - 1;
    await user.click(screen.getByRole('button', { name: 'scan-paired' }));

    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('scan-count-paired')).toHaveTextContent('1');
  });

  it('reports a rescan after the label leaves the frame but keeps counting it once', async () => {
    const user = await openScanner();

    await user.click(screen.getByRole('button', { name: 'scan-paired' }));
    now += RESCAN_COOLDOWN_MS;
    await user.click(screen.getByRole('button', { name: 'scan-paired' }));

    expect(toast.success).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(screen.getByTestId('scan-count-paired')).toHaveTextContent('1');
    });
  });
});
