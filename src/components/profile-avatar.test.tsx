import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileAvatar } from '@/components/profile-avatar';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

describe('ProfileAvatar', () => {
  it('renders a fallback initial when there is no picture', () => {
    const { container } = render(<ProfileAvatar picture={null} name="Monika" size={24} />);
    expect(container.textContent).toContain('M');
  });

  it('renders "?" fallback when there is no picture and no name', () => {
    const { container } = render(<ProfileAvatar picture={null} name={null} size={24} />);
    expect(container.textContent).toBe('?');
  });

  it('renders an image with a resolved URL for a storage key', () => {
    render(
      <ProfileAvatar picture="profile/user-1/1700000000000-abc.webp" name="Monika" size={24} />,
    );
    const img = screen.getByRole('img', { name: 'Monika' });
    expect(img).toHaveAttribute(
      'src',
      'https://project.supabase.co/storage/v1/object/public/avatars/profile/user-1/1700000000000-abc.webp',
    );
  });
});