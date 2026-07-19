import Image from "next/image";

interface ProfilePictureProps {
  src: string;
  alt: string;
  className?: string;
  /** Pixel size used for next/image width & height. */
  size: number;
}

/**
 * Renders an external profile/avatar image (e.g. Google OAuth) with next/image.
 * Uses unoptimized so arbitrary hostnames work without remotePatterns entries.
 */
export function ProfilePicture({ src, alt, className, size }: ProfilePictureProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      unoptimized
    />
  );
}
