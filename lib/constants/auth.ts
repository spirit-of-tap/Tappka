/**
 * Allowed work email domains for CZU authentication
 */
export const ALLOWED_WORK_EMAIL_DOMAINS = [
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
 * Validates that an email address ends with an allowed CZU domain
 * @param email - The email address to validate
 * @returns True if the email ends with @studenti.czu.cz or @pef.czu.cz, false otherwise
 */
export const isValidWorkEmailDomain = (email: string): boolean => {
  if (!email || !email.includes('@')) {
    return false;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_WORK_EMAIL_DOMAINS.includes(domain as any);
};
