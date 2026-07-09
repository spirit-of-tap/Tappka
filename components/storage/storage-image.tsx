'use client';

import Image from 'next/image';
import { getPublicStorageUrl, isExternalUrl } from '@/lib/storage/public-url';

interface StorageImageProps {
  storageKey: string | null;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}

export function StorageImage({
  storageKey,
  alt,
  className,
  width,
  height,
  fill,
}: StorageImageProps) {
  if (!storageKey) return null;

  const src = isExternalUrl(storageKey) ? storageKey : getPublicStorageUrl(storageKey);

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
}
