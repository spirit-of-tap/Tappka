import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';

import { ProfileContactList } from './profile-contact-list';

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const BASE_PROPS = {
  workEmail: 'student@studenti.czu.cz',
  personalEmail: null,
  phoneNumber: null,
  birthday: null,
  dateOfBirth: null,
};

async function openEditDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Upravit kontakt/i }));
  await screen.findByRole('dialog');
}

describe('ProfileContactList', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    refreshMock.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides editing on someone else profile', () => {
    render(<ProfileContactList {...BASE_PROPS} isOwnProfile={false} />);
    expect(screen.queryByRole('button', { name: /Upravit kontakt/i })).toBeNull();
    expect(screen.queryByText(/Doplň telefon/)).toBeNull();
  });

  it('prompts the owner to fill in missing contact details', () => {
    render(<ProfileContactList {...BASE_PROPS} isOwnProfile />);
    expect(screen.getByText(/Doplň telefon/)).toBeInTheDocument();
  });

  it('keeps the school e-mail read-only in the form', async () => {
    const user = userEvent.setup();
    render(<ProfileContactList {...BASE_PROPS} isOwnProfile />);
    await openEditDialog(user);
    expect(screen.getByLabelText('Školní e-mail')).toBeDisabled();
  });

  it('saves phone, personal e-mail and birthday', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    render(<ProfileContactList {...BASE_PROPS} isOwnProfile />);
    await openEditDialog(user);

    await user.type(screen.getByLabelText('Telefon'), '+420 777 123 456');
    await user.type(screen.getByLabelText('Osobní e-mail'), 'Jmeno@Gmail.com');
    await user.type(screen.getByLabelText('Narozeniny'), '2003-05-17');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/profile/contact');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({
      phone_number: '+420 777 123 456',
      personal_email: 'jmeno@gmail.com',
      date_of_birth: '2003-05-17',
    });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows a field error and does not call the API for an invalid phone', async () => {
    const user = userEvent.setup();
    render(<ProfileContactList {...BASE_PROPS} isOwnProfile />);
    await openEditDialog(user);

    await user.type(screen.getByLabelText('Telefon'), '123');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText(/Zadej telefon jen s číslicemi/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prefills the form with current values', async () => {
    const user = userEvent.setup();
    render(
      <ProfileContactList
        {...BASE_PROPS}
        phoneNumber="+420 777 123 456"
        personalEmail="jmeno@gmail.com"
        birthday="17. května 2003"
        dateOfBirth="2003-05-17"
        isOwnProfile
      />,
    );
    expect(screen.queryByText(/Doplň telefon/)).toBeNull();
    await openEditDialog(user);
    expect(screen.getByLabelText('Telefon')).toHaveValue('+420 777 123 456');
    expect(screen.getByLabelText('Osobní e-mail')).toHaveValue('jmeno@gmail.com');
    expect(screen.getByLabelText('Narozeniny')).toHaveValue('2003-05-17');
  });
});
