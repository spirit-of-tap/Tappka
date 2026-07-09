'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPublicStorageUrl, isExternalUrl } from '@/lib/storage/public-url';

interface StorageAvatarProps {
  storageKey: string | null;
  name: string;
  size?: "default" | "sm" | "lg" | "xl" | "2xl";
  className?: string;
}

function getInitials(name: string): string {
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
  const src = storageKey
    ? (isExternalUrl(storageKey) ? storageKey : getPublicStorageUrl(storageKey))
    : null;

  return (
    <Avatar size={size} className={className}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
