import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MELVIL_DISCOUNT } from '@/lib/constants/cteni';

import { MelvilDiscountCard } from './melvil-discount-card';

const BEFORE_LAUNCH = new Date('2026-11-04T10:59:59Z');
const AFTER_LAUNCH = new Date('2026-11-04T11:00:00Z');

describe('MelvilDiscountCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AFTER_LAUNCH);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders nothing before 4. 11. 12:00', () => {
    vi.setSystemTime(BEFORE_LAUNCH);
    const { container } = render(<MelvilDiscountCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the discount, the code and a tracked link to melvil.cz', () => {
    render(<MelvilDiscountCard />);

    expect(screen.getByRole('heading', { name: '30 % na knihy od Melvilu' })).toBeInTheDocument();
    expect(screen.getByText(MELVIL_DISCOUNT.code)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Nakupovat na melvil\.cz/ });
    expect(link).toHaveAttribute('href', MELVIL_DISCOUNT.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows the partner logo', () => {
    render(<MelvilDiscountCard />);

    expect(screen.getByRole('img', { name: 'Jan Melvil Publishing' })).toBeInTheDocument();
  });

  it('copies the code and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<MelvilDiscountCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Kopírovat kód' }));

    expect(await screen.findByRole('button', { name: 'Kód zkopírován' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(MELVIL_DISCOUNT.code);
  });
});
