import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ContentSourceForm } from './content-source-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const fetchSpy = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  fetchSpy.mockReset();
  push.mockReset();
});

describe('ContentSourceForm', () => {
  it('pre-fills 0.5 points when Podcast is selected', async () => {
    const user = userEvent.setup();
    render(<ContentSourceForm />);

    await user.click(screen.getByRole('button', { name: 'Podcast' }));

    expect(screen.getByLabelText('Body')).toHaveValue('0.5');
  });

  it('leaves points blank for Konference', async () => {
    const user = userEvent.setup();
    render(<ContentSourceForm />);

    await user.click(screen.getByRole('button', { name: 'Konference' }));

    expect(screen.getByLabelText('Body')).toHaveValue('');
  });

  it('submits the form and redirects to the essay editor with the new source', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'src-1' } }), { status: 201 }),
    );
    const user = userEvent.setup();
    render(<ContentSourceForm />);

    await user.click(screen.getByRole('button', { name: 'Podcast' }));
    await user.type(screen.getByLabelText('Název'), 'Founders');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(fetchSpy).toHaveBeenCalledWith('/api/content-sources', expect.objectContaining({ method: 'POST' }));
    expect(push).toHaveBeenCalledWith('/cteni/eseje/nova?source=src-1');
  });
});
