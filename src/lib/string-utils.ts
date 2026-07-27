export const SHORT_NAME_MAX = 12;

export function shortName(name: string): string {
  const parts = name.split(' ');
  const first = parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';
  const result = parts.length > 1 ? `${first} ${last.charAt(0)}.` : first;
  return result.length > SHORT_NAME_MAX ? result.slice(0, SHORT_NAME_MAX - 1) + '…' : result;
}
