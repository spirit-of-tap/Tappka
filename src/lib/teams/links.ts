/**
 * Team link and IČO formatting utilities
 */

export function formatUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function displayDomain(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  return trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

export function formatInstagramUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('@')) {
    return `https://instagram.com/${trimmed.slice(1)}`;
  }
  if (trimmed.includes('instagram.com/')) {
    return `https://${trimmed}`;
  }
  return `https://instagram.com/${trimmed}`;
}

export function displayInstagram(input: string | null | undefined): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('@')) {
    return trimmed;
  }
  const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/i);
  if (match?.[1]) {
    return `@${match[1]}`;
  }
  return `@${trimmed}`;
}

export function cleanIco(ico: string | null | undefined): string {
  if (!ico) return '';
  return ico.replace(/\s+/g, '').trim();
}

export function getPublicRegistryUrl(ico: string | null | undefined): string | null {
  const cleaned = cleanIco(ico);
  if (!cleaned) return null;
  return `https://verejnerejstriky.msp.gov.cz/vypis/${encodeURIComponent(cleaned)}`;
}

export function validateIco(ico: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } {
  const cleaned = cleanIco(ico);
  if (!cleaned) return { ok: true, value: null };
  if (!/^\d{8}$/.test(cleaned)) {
    return { ok: false, error: 'IČO musí mít přesně 8 číslic.' };
  }
  return { ok: true, value: cleaned };
}
