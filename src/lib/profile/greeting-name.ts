export const MAX_GREETING_NAME_LENGTH = 40;

export type GreetingNameValidation = { ok: true; value: string | null } | { ok: false; error: string };

/** Empty input clears the custom greeting (the dashboard falls back to the first name). */
export function validateGreetingName(raw: unknown): GreetingNameValidation {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: 'Neplatné oslovení' };
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value === '') return { ok: true, value: null };
  if (value.length > MAX_GREETING_NAME_LENGTH) {
    return { ok: false, error: `Oslovení může mít nejvýš ${MAX_GREETING_NAME_LENGTH} znaků` };
  }
  return { ok: true, value };
}

/** What the dashboard calls the person: their chosen greeting, else the first word of their name. */
export function greetingName(profile: { name: string | null; preferred_name?: string | null }): string {
  const preferred = profile.preferred_name?.trim();
  if (preferred) return preferred;
  return profile.name?.trim().split(/\s+/)[0] ?? '';
}
