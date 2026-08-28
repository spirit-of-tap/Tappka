import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackButton } from './back-button';

const back = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back, replace }),
}));

describe('BackButton', () => {
  beforeEach(() => {
    back.mockReset();
    replace.mockReset();
  });


  it('navigates back directly when no requestNavigation guard is passed', async () => {
    Object.defineProperty(window, 'history', { value: { length: 2 }, configurable: true });
    const user = userEvent.setup();
    render(<BackButton />);

    await user.click(screen.getByRole('button', { name: /Zpět/ }));

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('routes navigation through requestNavigation when passed, instead of navigating directly', async () => {
    Object.defineProperty(window, 'history', { value: { length: 2 }, configurable: true });
    const requestNavigation = vi.fn();
    const user = userEvent.setup();
    render(<BackButton requestNavigation={requestNavigation} />);

    await user.click(screen.getByRole('button', { name: /Zpět/ }));

    expect(requestNavigation).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();

    // Confirming runs the deferred navigation.
    requestNavigation.mock.calls[0][0]();
    expect(back).toHaveBeenCalledTimes(1);
  });
});
