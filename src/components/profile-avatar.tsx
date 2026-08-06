import { ProfilePicture } from '@/components/profile-picture';
import { getAvatarUrl } from '@/lib/storage/public-url';
import { cn } from '@/lib/utils';

interface ProfileAvatarProps {
  /** Raw ref from the DB — a storage key in the `avatars` bucket or an external URL. */
  picture: string | null | undefined;
  name: string | null | undefined;
  /** Pixel size of the avatar. */
  size: number;
  className?: string;
}

function getInitial(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

/**
 * Avatar that resolves a raw picture ref into a renderable URL and falls back
 * to the user's initial when there is no picture.
 */
export function ProfileAvatar({ picture, name, size, className }: ProfileAvatarProps) {
  const src = getAvatarUrl(picture);

  if (!src) {
    return (
      <div
        className={cn(
          'bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)) }}
      >
        {getInitial(name)}
      </div>
    );
  }

  return (
    <ProfilePicture
      src={src}
      alt={name ?? ''}
      size={size}
      className={cn('shrink-0 rounded-full object-cover', className)}
    />
  );
}
