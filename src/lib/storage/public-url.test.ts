import { describe, expect, it, vi } from 'vitest';
import {
  getAvatarUrl,
  getPublicStorageUrl,
  getTransformedImageSrcSet,
  getTransformedImageUrl,
} from '@/lib/storage/public-url';

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

describe('public image transformations', () => {
  it('builds a responsive srcset served directly by Supabase', () => {
    expect(
      getTransformedImageSrcSet('images', 'team-activities/team-1/photo.webp', [
        { width: 480, height: 320 },
        { width: 960, height: 640 },
      ], {
        quality: 72,
        resize: 'cover',
      }),
    ).toBe([
      'https://project.supabase.co/storage/v1/render/image/public/images/team-activities/team-1/photo.webp?width=480&height=320&quality=72&resize=cover 480w',
      'https://project.supabase.co/storage/v1/render/image/public/images/team-activities/team-1/photo.webp?width=960&height=640&quality=72&resize=cover 960w',
    ].join(', '));
  });

  it('encodes unsafe path segments without encoding folder separators', () => {
    expect(
      getTransformedImageUrl('images', 'team activities/photo #1.webp', { width: 480 }),
    ).toContain('/team%20activities/photo%20%231.webp?width=480');
  });
});
