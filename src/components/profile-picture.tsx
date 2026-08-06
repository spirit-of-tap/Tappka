'use client';

import { useState, type ReactNode } from "react";
import Image from "next/image";

interface ProfilePictureProps {
  src: string;
  alt: string;
  className?: string;
  /** Pixel size used for next/image width & height. */
  size: number;
  /** Rendered in place of the image when the source fails to load. */
  fallback?: ReactNode;
}

/**
 * Renders an external profile/avatar image (e.g. Google OAuth) with next/image.
 * Uses unoptimized so arbitrary hostnames work without remotePatterns entries.
 *
 * Client-side because a stored picture ref can point at an object that no
 * longer exists; without an onError swap the browser paints its broken-image
 * glyph and the alt text, which is worse than showing no picture at all.
 */
export function ProfilePicture({ src, alt, className, size, fallback }: ProfilePictureProps) {
  // Tracked by URL rather than a boolean so a changed src is retried instead
  // of staying stuck on the fallback.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (fallback != null && failedSrc === src) {
    return <>{fallback}</>;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      unoptimized
      onError={() => setFailedSrc(src)}
    />
  );
}
