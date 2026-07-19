import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates that a redirect URL is safe (same-origin or relative path)
 * Prevents open redirect vulnerabilities by rejecting external URLs
 * @param url - The URL to validate (can be relative path or absolute URL)
 * @param origin - The origin of the current request
 * @returns The validated safe path, or null if validation fails
 */
export function validateRedirectUrl(url: string | null, origin: string): string | null {
  if (!url) {
    return null;
  }

  // Reject empty strings
  if (url.trim() === "") {
    return null;
  }

  // Allow relative paths (starting with /)
  if (url.startsWith("/")) {
    // Ensure it doesn't contain protocol-relative URLs or other schemes
    if (url.includes("://") || url.startsWith("//") || url.startsWith("javascript:")) {
      return null;
    }
    return url;
  }

  // For absolute URLs, check if they're same-origin
  try {
    const urlObj = new URL(url, origin);
    const originObj = new URL(origin);

    // Reject if protocol doesn't match (http vs https)
    if (urlObj.protocol !== originObj.protocol) {
      return null;
    }

    // Reject if host doesn't match
    if (urlObj.host !== originObj.host) {
      return null;
    }

    // Return the pathname + search + hash (same-origin URL is safe)
    return urlObj.pathname + urlObj.search + urlObj.hash;
  } catch {
    // Invalid URL format
    return null;
  }
}

