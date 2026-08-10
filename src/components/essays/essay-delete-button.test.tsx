import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EssayDeleteButton } from '@/components/essays/essay-delete-button';

// hoisted: vi.mock is lifted above these declarations, and the sonner factory
// builds its object at resolution time rather than lazily like useRouter.
const { replace, error, success } = vi.hoisted(() => ({
  replace: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { error, success } }));

const fetchSpy = vi.spyOn(globalThis, 'fetch');

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchSpy.mockReset();
  replace.mockReset();
  error.mockReset();
  success.mockReset();
});

async function openConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Smazat/ }));
  return screen.getAllByRole('button', { name: /Smazat/ }).at(-1)!;
}

describe('EssayDeleteButton', () => {
  it('asks before deleting anything', async () => {
    const user = userEvent.setup();
    render(<EssayDeleteButton essayId="essay-1" isDraft />);

    await user.click(screen.getByRole('button', { name: /Smazat/ }));

    expect(await screen.findByText('Smazat koncept?')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('soft-deletes the essay and leaves the editor behind', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ success: true }));
    const user = userEvent.setup();
    render(<EssayDeleteButton essayId="essay-1" isDraft />);

    const confirm = await openConfirm(user);
    await user.click(confirm);

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith('/api/essays/essay-1', { method: 'DELETE' }),
    );
    // replace, not push: Back must not return to a deleted essay.
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/cteni/prehled'));
  });

  it('warns a published author about the BookPoints they give up', async () => {
    const user = userEvent.setup();
    render(<EssayDeleteButton essayId="essay-1" isDraft={false} points={3} />);

    await user.click(screen.getByRole('button', { name: /Smazat/ }));

    expect(await screen.findByText('Smazat esej?')).toBeInTheDocument();
    expect(screen.getByText(/3 BookPoints/)).toBeInTheDocument();
  });

  it('does not mention points when the essay earns none', async () => {
    const user = userEvent.setup();
    render(<EssayDeleteButton essayId="essay-1" isDraft={false} />);

    await user.click(screen.getByRole('button', { name: /Smazat/ }));

    expect(await screen.findByText('Smazat esej?')).toBeInTheDocument();
    expect(screen.queryByText(/BookPoints/)).not.toBeInTheDocument();
  });

  it('reports a refused delete and stays on the page', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'Esej nenalezena' }, 404));
    const user = userEvent.setup();
    render(<EssayDeleteButton essayId="essay-1" isDraft />);

    const confirm = await openConfirm(user);
    await user.click(confirm);

    await waitFor(() => expect(error).toHaveBeenCalledWith('Esej nenalezena'));
    expect(replace).not.toHaveBeenCalled();
  });
});
