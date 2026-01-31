/**
 * Allowed work email domains for CZU authentication
 */
export const ALLOWED_WORK_EMAIL_DOMAINS: readonly string[] = [
  'studenti.czu.cz',
  'pef.czu.cz',
] as const;

/**
 * Expected length of OTP codes for email verification
 */
export const OTP_LENGTH = 8;

/**
 * Valid email OTP types that can be used for verification
 * Used to validate query parameters before passing to Supabase auth API
 */
export const VALID_EMAIL_OTP_TYPES = ['email_change', 'email'] as const;

/**
 * Public route prefixes that do not require authentication
 * Routes starting with these prefixes are accessible without being logged in
 */
export const PUBLIC_ROUTE_PREFIXES: readonly string[] = [
  '/auth',
] as const;

/**
 * Checks if a given pathname is a public route
 * @param pathname - The pathname to check (e.g., '/auth/login')
 * @returns True if the pathname matches a public route, false otherwise
 */
export const isPublicRoute = (pathname: string): boolean => {
  // Exact match for root route
  if (pathname === '/') {
    return true;
  }
  // Check if pathname starts with any public route prefix
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

/**
 * Validates that an email address ends with an allowed CZU domain
 * @param email - The email address to validate
 * @returns True if the email ends with @studenti.czu.cz or @pef.czu.cz, false otherwise
 */
export const isValidWorkEmailDomain = (email: string): boolean => {
  if (!email || !email.includes('@')) {
    return false;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (domain === undefined) {
    return false;
  }
  return ALLOWED_WORK_EMAIL_DOMAINS.includes(domain);
};
