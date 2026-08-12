import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-barcode-scanner', () => ({
  BarcodeScanner: ({ onCapture }: { onCapture: (barcodes: { rawValue: string }[]) => void }) => (
    <button type="button" onClick={() => onCapture([{ rawValue: '9781501121746' }])}>
      scan-test
    </button>
  ),
}));

import { StepSearch } from './step-search';

const CATALOGUE_HIT = { id: 'existing-1', title_cs: 'Sprint', author: 'Jake Knapp' };
const EXTERNAL_HIT = {
  title: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: '9781501121746',
  description: null,
  cover_url: null,
  page_count: 288,
  publisher: 'Simon & Schuster',
  published_year: 2016,
  preview_link: null,
  source: 'google_books',
  external_id: 'vol-1',
};

function mockRoutes({ local = [], external = [] }: { local?: unknown[]; external?: unknown[] }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const body = input.includes('external-search') ? { data: external } : { data: local };
      return Promise.resolve({ ok: true, json: async () => body });
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('StepSearch', () => {
  it('shows catalogue matches before external ones so a duplicate dead-ends', async () => {
    mockRoutes({ local: [CATALOGUE_HIT], external: [EXTERNAL_HIT] });
    render(<StepSearch initialQuery="sprint" onSelect={vi.fn()} onManual={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/už v bobovi/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Sprint/ })).toHaveAttribute(
      'href',
      '/cteni/knihy/existing-1',
    );
  });

  it('shows page count and publisher on external candidates', async () => {
    mockRoutes({ external: [EXTERNAL_HIT] });
    render(<StepSearch initialQuery="sprint" onSelect={vi.fn()} onManual={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/288/)).toBeInTheDocument());
    expect(screen.getByText(/Simon & Schuster/)).toBeInTheDocument();
  });

  it('passes the chosen candidate up when its row is pressed', async () => {
    const onSelect = vi.fn();
    mockRoutes({ external: [EXTERNAL_HIT] });
    render(<StepSearch initialQuery="sprint" onSelect={onSelect} onManual={vi.fn()} />);

    const row = await waitFor(() => screen.getByRole('button', { name: /Jake Knapp/ }));
    await userEvent.click(row);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ external_id: 'vol-1' }));
  });

  it('hides the external results behind a confirmation when BOB already has the book', async () => {
    mockRoutes({ local: [CATALOGUE_HIT], external: [EXTERNAL_HIT] });
    render(<StepSearch initialQuery="sprint" onSelect={vi.fn()} onManual={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/už v bobovi/i)).toBeInTheDocument());
    expect(screen.queryByText(/mimo katalog/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /přesto přidat jinou verzi/i }));

    expect(screen.getByText(/mimo katalog/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Jake Knapp/ })).toBeInTheDocument();
  });

  it('surfaces a catalogue record when an ISBN resolves to a known title', async () => {
    mockRoutes({ local: [CATALOGUE_HIT], external: [EXTERNAL_HIT] });
    render(<StepSearch initialQuery="9781501121746" onSelect={vi.fn()} onManual={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/už v bobovi/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Sprint/ })).toHaveAttribute(
      'href',
      '/cteni/knihy/existing-1',
    );
    expect(screen.queryByText(/mimo katalog/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /přesto přidat jinou verzi/i }));
    expect(screen.getByRole('button', { name: /Jake Knapp/ })).toBeInTheDocument();
  });

  it('does not search the catalogue by title when the ISBN resolves to nothing', async () => {
    mockRoutes({ local: [CATALOGUE_HIT], external: [] });
    render(<StepSearch initialQuery="9780000000000" onSelect={vi.fn()} onManual={vi.fn()} />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('external-search'));
    expect(screen.queryByText(/už v bobovi/i)).not.toBeInTheDocument();
  });

  it('offers manual entry and requires both title and author', async () => {
    const onManual = vi.fn();
    mockRoutes({});
    render(<StepSearch initialQuery="neznámá" onSelect={vi.fn()} onManual={onManual} />);

    await userEvent.click(await screen.findByRole('button', { name: /zadat ručně/i }));

    const submit = screen.getByRole('button', { name: /pokračovat/i });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/název/i), 'Tiimiakatemia');
    await userEvent.type(screen.getByLabelText(/autor/i), 'Partanen');
    await userEvent.click(submit);

    expect(onManual).toHaveBeenCalledWith('Tiimiakatemia', 'Partanen');
  });

  it('offers the ISBN scanner', async () => {
    mockRoutes({});
    render(<StepSearch initialQuery="" onSelect={vi.fn()} onManual={vi.fn()} />);

    expect(screen.getByRole('button', { name: /naskenovat/i })).toBeInTheDocument();
  });

  it('closes the scanner and searches when a barcode is captured', async () => {
    mockRoutes({ external: [EXTERNAL_HIT] });
    render(<StepSearch initialQuery="" onSelect={vi.fn()} onManual={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /naskenovat/i }));
    expect(screen.getByText(/namiř kameru/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /scan-test/i }));

    expect(screen.queryByText(/namiř kameru/i)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('9781501121746')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Simon & Schuster/)).toBeInTheDocument());
  });
});
