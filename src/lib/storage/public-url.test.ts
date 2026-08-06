import { describe, expect, it, vi } from 'vitest';
import { getAvatarUrl, getPublicStorageUrl } from '@/lib/storage/public-url';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

describe('getAvatarUrl', () => {
  it('returns null for null/undefined/empty keys', () => {
    expect(getAvatarUrl(null)).toBeNull();
    expect(getAvatarUrl(undefined)).toBeNull();
  });

  it('builds the public URL for an avatars bucket key', () => {
    const key = 'profile/user-1/1700000000000-abc.webp';
    expect(getAvatarUrl(key)).toBe(
      getPublicStorageUrl('avatars', key),
    );
  });

  it('returns preset picture keys through the avatars bucket', () => {
    const key = 'profile-pictures/import/monika.webp';
    expect(getAvatarUrl(key)).toBe(
      getPublicStorageUrl('avatars', key),
    );
  });

  it('passes external URLs through unchanged', () => {
    const url = 'https://lh3.googleusercontent.com/a/abc';
    expect(getAvatarUrl(url)).toBe(url);
  });
});
