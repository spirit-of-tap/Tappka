import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GreetingNameForm } from './greeting-name-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('GreetingNameForm', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('saves the new greeting', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ preferred_name: 'Páťo' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<GreetingNameForm initialValue={null} fallbackName="Patrik" />);

    const save = screen.getByRole('button', { name: 'Uložit' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Oslovení'), { target: { value: 'Páťo' } });
    fireEvent.click(save);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ preferred_name: 'Páťo' });
  });
});
