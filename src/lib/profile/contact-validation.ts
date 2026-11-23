export const MAX_PERSONAL_EMAIL_LENGTH = 254;
export const MIN_PHONE_DIGITS = 9;
export const MAX_PHONE_DIGITS = 15;
export const MIN_BIRTH_YEAR = 1900;

const PHONE_ALLOWED_CHARS = /^\+?[\d\s]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface ContactInput {
  phone_number?: unknown;
  personal_email?: unknown;
  date_of_birth?: unknown;
}

export interface ContactValues {
  phone_number: string | null;
  personal_email: string | null;
  date_of_birth: string | null;
}

export type ContactField = keyof ContactValues;

interface ContactOk {
  ok: true;
  value: ContactValues;
}

interface ContactErr {
  ok: false;
  errors: Partial<Record<ContactField, string>>;
}

export type ContactValidation = ContactOk | ContactErr;

type FieldResult = { ok: true; value: string | null } | { ok: false; error: string };

function emptyToNull(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function validatePhone(raw: unknown): FieldResult {
  const value = emptyToNull(raw);
  if (value === undefined) return { ok: false, error: 'Neplatné telefonní číslo.' };
  if (value === null) return { ok: true, value: null };

  const collapsed = value.replace(/\s+/g, ' ');
  const digits = collapsed.replace(/\D/g, '').length;
  if (!PHONE_ALLOWED_CHARS.test(collapsed) || digits < MIN_PHONE_DIGITS || digits > MAX_PHONE_DIGITS) {
    return { ok: false, error: 'Zadej telefon jen s číslicemi, případně s předvolbou, např. +420 777 123 456.' };
  }
  return { ok: true, value: collapsed };
}

function validatePersonalEmail(raw: unknown): FieldResult {
  const value = emptyToNull(raw);
  if (value === undefined) return { ok: false, error: 'Neplatný e-mail.' };
  if (value === null) return { ok: true, value: null };

  if (value.length > MAX_PERSONAL_EMAIL_LENGTH || !EMAIL_PATTERN.test(value)) {
    return { ok: false, error: 'Zadej platný e-mail, např. jmeno@gmail.com.' };
  }
  return { ok: true, value: value.toLowerCase() };
}

function validateDateOfBirth(raw: unknown, today: Date): FieldResult {
  const value = emptyToNull(raw);
  if (value === undefined) return { ok: false, error: 'Neplatné datum narození.' };
  if (value === null) return { ok: true, value: null };

  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return { ok: false, error: 'Neplatné datum narození.' };

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls 2026-02-31 over to March, so a round-trip check rejects impossible days.
  const isRealDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isRealDate) return { ok: false, error: 'Neplatné datum narození.' };

  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (year < MIN_BIRTH_YEAR || date.getTime() > todayUtc) {
    return { ok: false, error: 'Datum narození musí být v minulosti.' };
  }
  return { ok: true, value };
}

export function validateContactInput(input: ContactInput, today: Date = new Date()): ContactValidation {
  const phone = validatePhone(input.phone_number);
  const email = validatePersonalEmail(input.personal_email);
  const birth = validateDateOfBirth(input.date_of_birth, today);

  if (phone.ok && email.ok && birth.ok) {
    return { ok: true, value: { phone_number: phone.value, personal_email: email.value, date_of_birth: birth.value } };
  }

  const errors: Partial<Record<ContactField, string>> = {};
  if (!phone.ok) errors.phone_number = phone.error;
  if (!email.ok) errors.personal_email = email.error;
  if (!birth.ok) errors.date_of_birth = birth.error;
  return { ok: false, errors };
}
