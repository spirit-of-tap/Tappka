/**
 * Storage Image Component
 * 
 * Wrapper for displaying images from B2 storage.
 * Handles fetching presigned URLs for private buckets.
 */

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

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
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!storageKey) {
      setPresignedUrl(null);
      return;
    }

    // If it's already a full URL (external or legacy), use it directly
    if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      setPresignedUrl(storageKey);
      return;
    }

    // Fetch presigned URL for B2 storage key
    const fetchPresignedUrl = async () => {
      try {
        const response = await fetch(
          `/api/storage/presign-download?key=${encodeURIComponent(storageKey)}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch presigned URL');
        }

        const data = await response.json();
        setPresignedUrl(data.data.url);
      } catch (err) {
        console.error('Error fetching presigned URL:', err);
        setError(true);
      }
    };

    fetchPresignedUrl();
  }, [storageKey]);

  if (!storageKey || error || !presignedUrl) {
    return null;
  }

  if (fill) {
    return (
      <Image
        src={presignedUrl}
        alt={alt}
        fill
        className={className}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    );
  }

  return (
    <Image
      src={presignedUrl}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
}
