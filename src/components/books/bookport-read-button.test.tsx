import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BookportReadButton } from './bookport-read-button';

const match = (overrides: Partial<Parameters<typeof BookportReadButton>[0]['match']> = {}) => ({
  title: 'Strážci růže',
  isbn: '978-80-249-5297-0',
  bookUrl: 'https://www.bookport.cz/kniha/strazci-ruze-15104/',
  loginUrl: 'https://www.bookport.cz/AccountSaml/SignIn/?returnUrl=%2Fkniha%2Fstrazci-ruze-15104%2F&idp=https%3A%2F%2Feduid.czu.cz%2Fidp%2Fshibboleth',
  ...overrides,
});

describe('BookportReadButton', () => {
  it('links to the ČZU-bound Bookport login url', () => {
    render(<BookportReadButton match={match()} />);
    const link = screen.getByRole('link', { name: /Číst zdarma/ });
    expect(link).toHaveAttribute('href', match().loginUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('explains Bookport and the ČZU login in a tooltip on hover', async () => {
    const user = userEvent.setup();
    render(<BookportReadButton match={match()} />);

    await user.hover(screen.getByRole('link', { name: /Číst zdarma/ }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Bookport');
    expect(tooltip.textContent).toContain('ČZU');
    expect(tooltip.textContent).toContain('is.czu.cz');
  });
});
