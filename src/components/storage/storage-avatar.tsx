'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/storage/public-url';

interface StorageAvatarProps {
  storageKey: string | null;
  name: string | null;
  size?: "default" | "sm" | "lg" | "xl" | "2xl";
  className?: string;
}

function getInitials(name: string | null): string {
  if (!name?.trim()) return '?';

  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function StorageAvatar({
  storageKey,
  name,
  size,
  className,
}: StorageAvatarProps) {
  const src = getAvatarUrl(storageKey);

  return (
    <Avatar size={size} className={className}>
      {src && <AvatarImage src={src} alt={name ?? undefined} />}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
