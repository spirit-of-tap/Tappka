/**
 * Storage Avatar Component
 * 
 * Avatar component that handles B2 storage keys and fetches presigned URLs.
 * Falls back to initials if no picture is available.
 */

'use client';

import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storageKey) {
      setPresignedUrl(null);
      return;
    }

    console.log('[StorageAvatar] Storage key:', storageKey);

    // If it's already a full URL (external or legacy), use it directly
    if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      console.log('[StorageAvatar] Using direct URL');
      setPresignedUrl(storageKey);
      return;
    }

    // Fetch presigned URL for B2 storage key
    setLoading(true);
    const fetchPresignedUrl = async () => {
      try {
        console.log('[StorageAvatar] Fetching presigned URL for:', storageKey);
        const response = await fetch(
          `/api/storage/presign-download?key=${encodeURIComponent(storageKey)}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[StorageAvatar] Failed to fetch presigned URL:', response.status, errorData);
          throw new Error('Failed to fetch presigned URL');
        }

        const data = await response.json();
        console.log('[StorageAvatar] Got presigned URL:', data.data.url.substring(0, 80) + '...');
        setPresignedUrl(data.data.url);
      } catch (err) {
        console.error('[StorageAvatar] Error fetching presigned URL:', err);
        setPresignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPresignedUrl();
  }, [storageKey]);

  return (
    <Avatar size={size} className={className}>
      {presignedUrl && !loading && (
        <AvatarImage src={presignedUrl} alt={name} />
      )}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
